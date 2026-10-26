//! Stylesheet parsing and selector extraction.
//!
//! [`analyze_css`] parses CSS with `lightningcss`, walks the resulting AST with
//! a [`Visitor`], and produces a serializable [`CssAnalysisResult`]. Parsing is
//! performed with error recovery enabled: malformed constructs are skipped and
//! reported as warnings, while valid rules are still analyzed.

use std::collections::BTreeSet;
use std::convert::Infallible;
use std::sync::{Arc, RwLock};

use cssparser::ToCss as CssparserToCss;
use lightningcss::error::{Error, ParserError};
use lightningcss::rules::CssRule;
use lightningcss::rules::style::StyleRule;
use lightningcss::selector::{Component, Selector};
use lightningcss::stylesheet::{ParserOptions, PrinterOptions, StyleSheet};
use lightningcss::visit_types;
use lightningcss::visitor::{Visit, VisitTypes, Visitor};

use crate::model::{
    AnalysisStats, AnalysisWarning, CssAnalysisResult, SelectorInfo, SelectorKind, SourceLocation,
    Specificity, StyleRuleInfo,
};

/// Filename used in parser diagnostics when no other name is supplied.
const DEFAULT_FILENAME: &str = "<css>";

/// Parses a CSS string and extracts all selectors and style rules.
///
/// The parser runs in error-recovery mode. Recoverable syntax errors do not
/// abort the analysis: valid rules are returned and malformed parts are
/// reported in [`CssAnalysisResult::warnings`]. An `Err` is returned only when
/// `lightningcss` cannot parse the stylesheet at all.
///
/// # Errors
///
/// Returns a human-readable error message when the stylesheet cannot be parsed.
///
/// # Examples
///
/// ```
/// use css_doctor_core::analyze_css;
///
/// let result = analyze_css(".btn, .card:hover { color: red; }").unwrap();
/// assert_eq!(result.selectors.len(), 2);
/// assert!(result.selectors[0].has_class("btn"));
/// assert!(result.selectors[1].has_class("card"));
/// ```
pub fn analyze_css(css_content: &str) -> Result<CssAnalysisResult, String> {
    let warnings = Arc::new(RwLock::new(Vec::new()));
    let options = ParserOptions {
        filename: DEFAULT_FILENAME.to_owned(),
        error_recovery: true,
        warnings: Some(Arc::clone(&warnings)),
        ..ParserOptions::default()
    };

    let mut stylesheet =
        StyleSheet::parse(css_content, options).map_err(|error| format_parse_error(&error))?;

    let mut visitor = CssVisitor::default();
    if let Err(never) = stylesheet.visit(&mut visitor) {
        // `CssVisitor::Error` is `Infallible`, so this branch is unreachable by
        // construction. Match instead of unwrapping to keep the library
        // panic-free.
        match never {}
    }

    let warnings = warnings
        .read()
        .map(|guard| {
            guard
                .iter()
                .cloned()
                .map(warning_from_error)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let stats = build_stats(&visitor.selectors, &visitor.rules, warnings.len());

    Ok(CssAnalysisResult {
        selectors: visitor.selectors,
        rules: visitor.rules,
        stats,
        warnings,
    })
}

/// Visitor that records style rules and their selectors.
///
/// Only the `RULES` visit type is requested. Style rules are handled manually
/// so selectors can be associated with their owning rule and with the nesting
/// hierarchy; all other rules (media, supports, layer, container, ...) fall
/// back to the default recursive traversal.
#[derive(Debug, Default)]
struct CssVisitor {
    selectors: Vec<SelectorInfo>,
    rules: Vec<StyleRuleInfo>,
    /// Stack of enclosing style-rule indices.
    style_stack: Vec<usize>,
}

impl CssVisitor {
    fn record_style_rule(&mut self, style: &mut StyleRule<'_>) -> Result<(), Infallible> {
        let rule_index = self.rules.len();
        let parent_rule_index = self.style_stack.last().copied();
        let nesting_depth = self.style_stack.len();

        let selector_start = self.selectors.len();
        for selector in &style.selectors.0 {
            self.selectors.push(SelectorInfo::from_selector(
                selector,
                rule_index,
                nesting_depth,
            ));
        }

        self.rules.push(StyleRuleInfo {
            index: rule_index,
            parent_rule_index,
            selector_indices: (selector_start..self.selectors.len()).collect(),
            declaration_count: style.declarations.declarations.len(),
            important_declaration_count: style.declarations.important_declarations.len(),
            nesting_depth,
            location: SourceLocation::new(style.loc.line.saturating_add(1), style.loc.column),
        });

        self.style_stack.push(rule_index);
        let result = style.rules.visit_children(self);
        self.style_stack.pop();

        result
    }
}

impl<'i> Visitor<'i> for CssVisitor {
    type Error = Infallible;

    fn visit_types(&self) -> VisitTypes {
        visit_types!(RULES)
    }

    fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<(), Self::Error> {
        match rule {
            CssRule::Style(style) => self.record_style_rule(style),
            other => other.visit_children(self),
        }
    }
}

impl SelectorInfo {
    /// Extracts a structured representation from a `lightningcss` selector.
    fn from_selector(selector: &Selector<'_>, rule_index: usize, nesting_depth: usize) -> Self {
        let raw = <Selector<'_> as lightningcss::traits::ToCss>::to_css_string(
            selector,
            PrinterOptions::default(),
        )
        .unwrap_or_default();

        let mut info = Self {
            raw,
            specificity: Specificity::from_packed(selector.specificity()),
            rule_index,
            nesting_depth,
            ..Self::default()
        };

        collect_selector(selector, &mut info);
        deduplicate(&mut info);

        info
    }
}

/// Recursively collects symbols from a selector and its nested selector lists.
///
/// `lightningcss` stores the compounds of a selector from right to left, while
/// simple selectors within a compound are stored in source order. Splitting the
/// components into compounds and walking them in reverse preserves source order
/// in the extracted symbol lists.
fn collect_selector(selector: &Selector<'_>, info: &mut SelectorInfo) {
    let mut compounds: Vec<Vec<&Component<'_>>> = vec![Vec::new()];
    let mut boundaries: Vec<Option<usize>> = vec![None];
    let mut combinators = Vec::new();

    for component in selector.iter_raw_match_order() {
        match component {
            Component::Combinator(combinator) if is_compound_separator(*combinator) => {
                if let Some(symbol) = combinator_symbol(*combinator) {
                    combinators.push(symbol);
                }
                compounds.push(Vec::new());
                boundaries.push(None);
            }
            Component::Combinator(_) => {
                // Pseudo-element and shadow-DOM combinators are internal
                // markers, not user-visible tree combinators. They split a
                // compound in the AST but not in the source selector, so
                // remember where the pseudo-element boundary is.
                if let Some(boundary) = boundaries.last_mut() {
                    if boundary.is_none() {
                        *boundary = Some(compounds.last().map_or(0, Vec::len));
                    }
                }
            }
            _ => {
                if let Some(compound) = compounds.last_mut() {
                    compound.push(component);
                }
            }
        }
    }

    for (compound, boundary) in compounds.into_iter().zip(boundaries).rev() {
        let mut compound_info = SelectorInfo::default();
        if let Some(boundary) = boundary {
            for component in compound.iter().skip(boundary) {
                collect_component(component, &mut compound_info);
            }
            for component in compound.iter().take(boundary) {
                collect_component(component, &mut compound_info);
            }
        } else {
            for component in &compound {
                collect_component(component, &mut compound_info);
            }
        }
        merge_symbols(info, compound_info);
    }

    // Combinators were discovered right-to-left; restore source order.
    for symbol in combinators.into_iter().rev() {
        info.combinators.push(symbol.to_owned());
    }
}

fn merge_symbols(target: &mut SelectorInfo, source: SelectorInfo) {
    target.kinds.extend(source.kinds);
    target.classes.extend(source.classes);
    target.ids.extend(source.ids);
    target.tags.extend(source.tags);
    target.attributes.extend(source.attributes);
    target.pseudo_classes.extend(source.pseudo_classes);
    target.pseudo_elements.extend(source.pseudo_elements);
    target.combinators.extend(source.combinators);
}

fn is_compound_separator(combinator: lightningcss::selector::Combinator) -> bool {
    use lightningcss::selector::Combinator;

    !matches!(
        combinator,
        Combinator::PseudoElement | Combinator::SlotAssignment | Combinator::Part
    )
}

fn collect_component(component: &Component<'_>, info: &mut SelectorInfo) {
    match component {
        Component::Class(name) => {
            info.classes.push(name.0.to_string());
            info.kinds.push(SelectorKind::Class);
        }
        Component::ID(name) => {
            info.ids.push(name.0.to_string());
            info.kinds.push(SelectorKind::Id);
        }
        Component::LocalName(name) => {
            info.tags.push(name.name.0.to_string());
            info.kinds.push(SelectorKind::Tag);
        }
        Component::ExplicitUniversalType => info.kinds.push(SelectorKind::Universal),
        Component::AttributeInNoNamespaceExists { local_name, .. }
        | Component::AttributeInNoNamespace { local_name, .. } => {
            info.attributes.push(local_name.0.to_string());
            info.kinds.push(SelectorKind::Attribute);
        }
        Component::AttributeOther(attribute) => {
            info.attributes.push(attribute.local_name.0.to_string());
            info.kinds.push(SelectorKind::Attribute);
        }
        Component::Combinator(_) => {}
        Component::Root
        | Component::Empty
        | Component::Scope
        | Component::Nth(_)
        | Component::NonTSPseudoClass(_) => {
            add_pseudo(component, info, false);
        }
        Component::PseudoElement(_) => add_pseudo(component, info, true),
        Component::NthOf(data) => {
            add_pseudo(component, info, false);
            for selector in data.selectors() {
                collect_selector(selector, info);
            }
        }
        Component::Negation(selectors)
        | Component::Is(selectors)
        | Component::Where(selectors)
        | Component::Has(selectors) => {
            add_pseudo(component, info, false);
            for selector in selectors.iter() {
                collect_selector(selector, info);
            }
        }
        Component::Any(_, selectors) => {
            add_pseudo(component, info, false);
            for selector in selectors.iter() {
                collect_selector(selector, info);
            }
        }
        Component::Host(selector) => {
            add_pseudo(component, info, false);
            if let Some(selector) = selector {
                collect_selector(selector, info);
            }
        }
        Component::Slotted(selector) => {
            add_pseudo(component, info, true);
            collect_selector(selector, info);
        }
        Component::Part(_) => add_pseudo(component, info, true),
        Component::Nesting => info.kinds.push(SelectorKind::Nesting),
        Component::DefaultNamespace(_)
        | Component::ExplicitNoNamespace
        | Component::ExplicitAnyNamespace
        | Component::Namespace(_, _) => {}
    }
}

/// Records a pseudo-class or pseudo-element by serializing the component and
/// reading its name. This keeps the implementation independent of the large
/// `PseudoClass`/`PseudoElement` enums while still supporting vendor prefixes
/// and custom pseudo selectors.
fn add_pseudo(component: &Component<'_>, info: &mut SelectorInfo, is_pseudo_element: bool) {
    let mut css = String::new();
    if component.to_css(&mut css).is_err() {
        return;
    }

    let Some(rest) = css.strip_prefix("::").or_else(|| css.strip_prefix(':')) else {
        return;
    };

    let name = rest
        .split(|character: char| character == '(' || character.is_whitespace())
        .next()
        .unwrap_or_default();

    if name.is_empty() {
        return;
    }

    if is_pseudo_element {
        info.pseudo_elements.push(name.to_owned());
        info.kinds.push(SelectorKind::PseudoElement);
    } else {
        info.pseudo_classes.push(name.to_owned());
        info.kinds.push(SelectorKind::PseudoClass);
    }
}

fn combinator_symbol(combinator: lightningcss::selector::Combinator) -> Option<&'static str> {
    use lightningcss::selector::Combinator;

    match combinator {
        Combinator::Descendant => Some(" "),
        Combinator::Child => Some(">"),
        Combinator::NextSibling => Some("+"),
        Combinator::LaterSibling => Some("~"),
        Combinator::DeepDescendant => Some(">>>"),
        Combinator::Deep => Some("/deep/"),
        Combinator::PseudoElement | Combinator::SlotAssignment | Combinator::Part => None,
    }
}

fn deduplicate(info: &mut SelectorInfo) {
    deduplicate_vec(&mut info.kinds);
    deduplicate_vec(&mut info.classes);
    deduplicate_vec(&mut info.ids);
    deduplicate_vec(&mut info.tags);
    deduplicate_vec(&mut info.attributes);
    deduplicate_vec(&mut info.pseudo_classes);
    deduplicate_vec(&mut info.pseudo_elements);
    deduplicate_vec(&mut info.combinators);
}

fn deduplicate_vec<T: PartialEq>(values: &mut Vec<T>) {
    let mut index = 0;
    while index < values.len() {
        let is_duplicate = values[..index].contains(&values[index]);
        if is_duplicate {
            values.remove(index);
        } else {
            index += 1;
        }
    }
}

fn build_stats(
    selectors: &[SelectorInfo],
    rules: &[StyleRuleInfo],
    warning_count: usize,
) -> AnalysisStats {
    let classes = selectors
        .iter()
        .flat_map(|selector| selector.classes.iter().map(String::as_str))
        .collect::<BTreeSet<_>>();
    let ids = selectors
        .iter()
        .flat_map(|selector| selector.ids.iter().map(String::as_str))
        .collect::<BTreeSet<_>>();
    let tags = selectors
        .iter()
        .flat_map(|selector| selector.tags.iter().map(String::as_str))
        .collect::<BTreeSet<_>>();
    let attributes = selectors
        .iter()
        .flat_map(|selector| selector.attributes.iter().map(String::as_str))
        .collect::<BTreeSet<_>>();

    let declaration_count = rules.iter().map(|rule| rule.declaration_count).sum();
    let important_declaration_count = rules
        .iter()
        .map(|rule| rule.important_declaration_count)
        .sum();
    let max_nesting_depth = rules
        .iter()
        .map(|rule| rule.nesting_depth)
        .max()
        .unwrap_or_default();

    AnalysisStats {
        rule_count: rules.len(),
        selector_count: selectors.len(),
        declaration_count,
        important_declaration_count,
        unique_class_count: classes.len(),
        unique_id_count: ids.len(),
        unique_tag_count: tags.len(),
        unique_attribute_count: attributes.len(),
        max_nesting_depth,
        warning_count,
    }
}

fn warning_from_error(error: Error<ParserError<'_>>) -> AnalysisWarning {
    let location = error
        .loc
        .as_ref()
        .map(|location| SourceLocation::new(location.line.saturating_add(1), location.column));

    AnalysisWarning {
        message: error.kind.to_string(),
        location,
    }
}

fn format_parse_error(error: &Error<ParserError<'_>>) -> String {
    match &error.loc {
        Some(location) => format!(
            "failed to parse CSS at {}:{}: {}",
            location.line.saturating_add(1),
            location.column,
            error.kind
        ),
        None => format!("failed to parse CSS: {}", error.kind),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn analyze(css: &str) -> CssAnalysisResult {
        analyze_css(css).expect("valid CSS should parse")
    }

    #[test]
    fn parses_a_single_class_rule() {
        let result = analyze(".btn { color: red; padding: 4px 8px; }");

        assert_eq!(result.rules.len(), 1);
        assert_eq!(result.selectors.len(), 1);
        assert!(result.warnings.is_empty());

        let selector = &result.selectors[0];
        assert_eq!(selector.raw, ".btn");
        assert_eq!(selector.classes, vec!["btn"]);
        assert_eq!(selector.kinds, vec![SelectorKind::Class]);
        assert_eq!(selector.specificity, Specificity::new(0, 1, 0));
        assert_eq!(selector.rule_index, 0);
        assert_eq!(selector.nesting_depth, 0);

        let rule = &result.rules[0];
        assert_eq!(rule.declaration_count, 2);
        assert_eq!(rule.important_declaration_count, 0);
        assert_eq!(rule.selector_indices, vec![0]);
        assert_eq!(rule.location, SourceLocation::new(1, 1));

        assert_eq!(result.stats.rule_count, 1);
        assert_eq!(result.stats.selector_count, 1);
        assert_eq!(result.stats.declaration_count, 2);
        assert_eq!(result.stats.unique_class_count, 1);
    }

    #[test]
    fn splits_selector_lists_and_keeps_pseudo_classes() {
        let result = analyze(
            r#"
            .btn, .card:hover {
              color: red;
            }

            a:focus-visible, button:disabled {
              outline: none;
            }
            "#,
        );

        assert_eq!(result.rules.len(), 2);
        assert_eq!(result.selectors.len(), 4);
        assert_eq!(
            result.selector_texts().collect::<Vec<_>>(),
            vec![".btn", ".card:hover", "a:focus-visible", "button:disabled"]
        );

        let card = &result.selectors[1];
        assert_eq!(card.classes, vec!["card"]);
        assert_eq!(card.pseudo_classes, vec!["hover"]);
        assert_eq!(
            card.kinds,
            vec![SelectorKind::Class, SelectorKind::PseudoClass]
        );

        assert_eq!(result.selectors[2].tags, vec!["a"]);
        assert_eq!(result.selectors[2].pseudo_classes, vec!["focus-visible"]);
        assert_eq!(result.selectors[3].tags, vec!["button"]);
    }

    #[test]
    fn extracts_ids_tags_attributes_combinators_and_pseudo_elements() {
        let result = analyze(
            r#"
            #app main > .card[data-state="open"]::before {
              content: "";
            }
            "#,
        );

        let selector = &result.selectors[0];
        assert_eq!(
            selector.raw,
            "#app main > .card[data-state=\"open\"]:before"
        );
        assert_eq!(selector.ids, vec!["app"]);
        assert_eq!(selector.tags, vec!["main"]);
        assert_eq!(selector.classes, vec!["card"]);
        assert_eq!(selector.attributes, vec!["data-state"]);
        assert_eq!(selector.pseudo_elements, vec!["before"]);
        assert_eq!(selector.combinators, vec![" ", ">"]);
        assert_eq!(
            selector.kinds,
            vec![
                SelectorKind::Id,
                SelectorKind::Tag,
                SelectorKind::Class,
                SelectorKind::Attribute,
                SelectorKind::PseudoElement,
            ]
        );
        assert_eq!(selector.specificity, Specificity::new(1, 2, 2));
    }

    #[test]
    fn visits_rules_inside_conditional_at_rules() {
        let result = analyze(
            r#"
            @media (min-width: 768px) {
              .card:hover { color: blue; }
              @supports (display: grid) {
                .layout > .cell { display: grid; }
              }
            }

            @layer utilities {
              .hidden { display: none !important; }
            }
            "#,
        );

        assert_eq!(result.rules.len(), 3);
        assert_eq!(result.selectors.len(), 3);
        assert_eq!(
            result.selector_texts().collect::<Vec<_>>(),
            vec![".card:hover", ".layout > .cell", ".hidden"]
        );

        assert_eq!(result.rules[0].location.line, 3);
        assert_eq!(result.rules[2].important_declaration_count, 1);
        assert_eq!(result.stats.declaration_count, 2);
        assert_eq!(result.stats.important_declaration_count, 1);
    }

    #[test]
    fn handles_css_nesting_and_records_parent_links() {
        let result = analyze(
            r#"
            .card {
              color: red;

              .title { font-weight: bold; }
              &:hover { color: blue; }

              @media (min-width: 600px) {
                .body { padding: 8px; }
              }
            }
            "#,
        );

        assert_eq!(result.rules.len(), 4);
        assert_eq!(result.selectors.len(), 4);

        assert_eq!(result.rules[0].parent_rule_index, None);
        assert_eq!(result.rules[0].nesting_depth, 0);
        assert_eq!(result.rules[1].parent_rule_index, Some(0));
        assert_eq!(result.rules[1].nesting_depth, 1);
        assert_eq!(result.rules[2].parent_rule_index, Some(0));
        assert_eq!(result.rules[3].parent_rule_index, Some(0));
        assert_eq!(result.stats.max_nesting_depth, 1);

        assert_eq!(result.selectors[1].nesting_depth, 1);
        assert!(result.selectors[1].has_class("title"));
        assert_eq!(result.selectors[2].pseudo_classes, vec!["hover"]);
    }

    #[test]
    fn collects_selectors_nested_inside_functional_pseudo_classes() {
        let result = analyze(
            r#"
            .card:is(.featured, #hero) [data-kind="badge"]:not(.muted) {
              color: red;
            }
            .list:has(> .item.active) > li:nth-child(2n of .highlight) {
              color: blue;
            }
            "#,
        );

        let card = &result.selectors[0];
        assert_eq!(card.classes, vec!["card", "featured", "muted"]);
        assert_eq!(card.ids, vec!["hero"]);
        assert_eq!(card.attributes, vec!["data-kind"]);
        assert!(card.pseudo_classes.contains(&"is".to_string()));
        assert!(card.pseudo_classes.contains(&"not".to_string()));

        let list = &result.selectors[1];
        assert_eq!(list.classes, vec!["list", "item", "active", "highlight"]);
        assert!(list.pseudo_classes.contains(&"has".to_string()));
        assert!(list.pseudo_classes.contains(&"nth-child".to_string()));
        assert_eq!(list.combinators, vec![">"]);
    }

    #[test]
    fn empty_and_comment_only_stylesheets_are_valid() {
        for css in ["", "   \n\t  ", "/* nothing to see here */"] {
            let result = analyze(css);
            assert!(result.is_empty());
            assert!(result.selectors.is_empty());
            assert!(result.rules.is_empty());
            assert!(result.warnings.is_empty());
            assert_eq!(result.stats, AnalysisStats::default());
        }
    }

    #[test]
    fn recovers_from_invalid_declarations_without_panicking() {
        let result = analyze(
            r#"
            .valid {
              color red;
              background: blue;
            }
            "#,
        );

        assert_eq!(result.rules.len(), 1);
        assert_eq!(result.selectors[0].raw, ".valid");
        assert_eq!(result.rules[0].declaration_count, 1);
        assert!(!result.warnings.is_empty());
        assert_eq!(result.stats.warning_count, result.warnings.len());
    }

    #[test]
    fn malformed_input_does_not_panic() {
        let invalid_inputs = [
            "}",
            "}{",
            ".broken {",
            ".broken { color: red;",
            "@media (min-width: {",
            "@unknown foo { bar }",
            ".a { color: ; } .b { color: blue; }",
            "this is not css",
        ];

        for css in invalid_inputs {
            // The contract is that analysis never panics. It may either return
            // a partial result with warnings or a descriptive Err.
            match analyze_css(css) {
                Ok(result) => {
                    let _ = result.stats.selector_count;
                }
                Err(message) => assert!(!message.is_empty()),
            }
        }
    }

    #[test]
    fn analyzes_valid_rules_after_a_malformed_rule() {
        let result = analyze(
            r#"
            .broken {
              color red;
            }
            .healthy {
              color: green;
            }
            "#,
        );

        assert_eq!(result.rules.len(), 2);
        assert_eq!(result.selectors.len(), 2);
        assert!(
            result
                .selectors
                .iter()
                .any(|selector| selector.raw == ".healthy")
        );
        assert!(!result.warnings.is_empty());
    }

    #[test]
    fn builds_usage_matrix_and_dead_code_candidates() {
        let result = analyze(
            r#"
            .btn, .btn:hover { color: red; }
            #app .card { color: blue; }
            "#,
        );

        let matrix = result.usage_matrix();
        assert_eq!(matrix.classes.get("btn"), Some(&2));
        assert_eq!(matrix.classes.get("card"), Some(&1));
        assert_eq!(matrix.ids.get("app"), Some(&1));
        assert_eq!(matrix.selectors.get(".btn"), Some(&1));

        let used = BTreeSet::from(["btn".to_string(), "app".to_string()]);
        assert_eq!(matrix.unused_classes(&used), vec!["card"]);
        assert!(matrix.unused_ids(&used).is_empty());
    }

    #[test]
    fn reports_the_correct_specificity() {
        let result = analyze(
            r#"
            .card { color: red; }
            #app .card { color: blue; }
            #app main > .card:is(.featured, #hero)::before { color: green; }
            "#,
        );

        assert_eq!(result.selectors[0].specificity, Specificity::new(0, 1, 0));
        assert_eq!(result.selectors[1].specificity, Specificity::new(1, 1, 0));
        assert_eq!(result.selectors[2].specificity, Specificity::new(2, 1, 2));
    }
}
