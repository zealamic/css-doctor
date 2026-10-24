//! Data model returned by the CSS analyzer.
//!
//! Every type in this module is `serde`-enabled so the same structures can be
//! sent to JavaScript through NAPI-RS (or any other JSON boundary) without an
//! intermediate representation.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::usage::UsageMatrix;

/// The kind of a simple selector found in a compound selector.
///
/// A single selector may contain several kinds (for example
/// `.card:hover::before` is both a class and a pseudo-element selector).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SelectorKind {
    /// A class selector such as `.button`.
    Class,
    /// An ID selector such as `#app`.
    Id,
    /// A type/tag selector such as `section` or `svg|rect`.
    Tag,
    /// An attribute selector such as `[data-state="open"]`.
    Attribute,
    /// A pseudo-class such as `:hover` or `:nth-child(2n + 1)`.
    PseudoClass,
    /// A pseudo-element such as `::before` or `::part(label)`.
    PseudoElement,
    /// The universal selector `*`.
    Universal,
    /// The CSS nesting selector `&`.
    Nesting,
}

/// Decoded CSS specificity.
///
/// CSS specificity is stored by `lightningcss` as a packed `u32` using
/// 10 bits per component. This type exposes the three components explicitly
/// and can round-trip the packed representation via [`Specificity::packed`]
/// and [`Specificity::from_packed`].
#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
)]
#[serde(rename_all = "camelCase")]
pub struct Specificity {
    /// Number of ID selectors.
    pub ids: u16,
    /// Number of class, attribute and pseudo-class selectors.
    pub classes: u16,
    /// Number of type and pseudo-element selectors.
    pub types: u16,
}

impl Specificity {
    /// Creates a specificity from its three components.
    #[must_use]
    pub const fn new(ids: u16, classes: u16, types: u16) -> Self {
        Self {
            ids,
            classes,
            types,
        }
    }

    /// Decodes the packed representation used by `lightningcss`.
    #[must_use]
    pub const fn from_packed(packed: u32) -> Self {
        Self {
            ids: ((packed >> 20) & 0x3ff) as u16,
            classes: ((packed >> 10) & 0x3ff) as u16,
            types: (packed & 0x3ff) as u16,
        }
    }

    /// Encodes the specificity using the same layout as `lightningcss`.
    #[must_use]
    pub const fn packed(self) -> u32 {
        ((self.ids as u32) << 20) | ((self.classes as u32) << 10) | self.types as u32
    }
}

impl std::fmt::Display for Specificity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "({},{},{})", self.ids, self.classes, self.types)
    }
}

/// A 1-based source location.
#[derive(
    Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
)]
#[serde(rename_all = "camelCase")]
pub struct SourceLocation {
    /// 1-based line number.
    pub line: u32,
    /// 1-based column number.
    pub column: u32,
}

impl SourceLocation {
    /// Creates a new source location.
    #[must_use]
    pub const fn new(line: u32, column: u32) -> Self {
        Self { line, column }
    }
}

impl std::fmt::Display for SourceLocation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}:{}", self.line, self.column)
    }
}

/// A non-fatal problem encountered while parsing the stylesheet.
///
/// With error recovery enabled, `lightningcss` skips the malformed part of the
/// input and keeps going. Those skipped parts are reported here instead of
/// aborting the whole analysis.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisWarning {
    /// Human-readable description of the problem.
    pub message: String,
    /// Location of the problem, when the parser could determine one.
    pub location: Option<SourceLocation>,
}

/// A single selector extracted from a style rule.
///
/// `raw` is the selector exactly as re-serialized by `lightningcss`, while the
/// remaining fields are structured views of the same selector. Nested
/// selectors (inside `:is()`, `:not()`, `:has()`, `:where()`, `:nth-child(... of S)`,
/// `:host()`, `::slotted()`) are included in the structured fields as well.
///
/// Symbol vectors are de-duplicated per selector: `.btn.btn` yields a single
/// `"btn"` class entry. Use [`SelectorInfo::raw`] when exact source structure
/// matters.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectorInfo {
    /// Normalized CSS text of the selector.
    pub raw: String,
    /// Every kind of simple selector present, in discovery order.
    pub kinds: Vec<SelectorKind>,
    /// Class names without the leading dot.
    pub classes: Vec<String>,
    /// ID names without the leading hash.
    pub ids: Vec<String>,
    /// Local type/tag names as written in the source (without any namespace).
    pub tags: Vec<String>,
    /// Local attribute names without brackets (without any namespace).
    pub attributes: Vec<String>,
    /// Pseudo-class names without the leading colon or arguments.
    pub pseudo_classes: Vec<String>,
    /// Pseudo-element names without the leading `::` or arguments.
    pub pseudo_elements: Vec<String>,
    /// Tree combinators present in the selector (`" "`, `">"`, `"+"`, `"~"`).
    pub combinators: Vec<String>,
    /// Decoded specificity.
    pub specificity: Specificity,
    /// Index into [`CssAnalysisResult::rules`].
    pub rule_index: usize,
    /// Number of enclosing style rules (top-level rules have depth `0`).
    pub nesting_depth: usize,
}

impl SelectorInfo {
    /// Returns whether the selector references the given class name.
    #[must_use]
    pub fn has_class(&self, name: &str) -> bool {
        self.classes.iter().any(|class| class == name)
    }

    /// Returns whether the selector references the given ID name.
    #[must_use]
    pub fn has_id(&self, name: &str) -> bool {
        self.ids.iter().any(|id| id == name)
    }

    /// Returns whether the selector references the given type/tag name.
    ///
    /// Matching is ASCII case-insensitive because HTML type selectors are
    /// case-insensitive.
    #[must_use]
    pub fn has_tag(&self, name: &str) -> bool {
        self.tags.iter().any(|tag| tag.eq_ignore_ascii_case(name))
    }

    /// Returns whether this selector is a simple class selector (`.foo`).
    #[must_use]
    pub fn is_class_selector(&self) -> bool {
        self.kinds == [SelectorKind::Class]
    }

    /// Returns whether this selector is a simple ID selector (`#foo`).
    #[must_use]
    pub fn is_id_selector(&self) -> bool {
        self.kinds == [SelectorKind::Id]
    }
}

/// A style rule and the selectors that belong to it.
///
/// Rules are stored in document order. Nested rules carry a
/// `parent_rule_index` pointing at the enclosing style rule, which makes the
/// data usable for tree rewrites and dead-code removal without re-parsing.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StyleRuleInfo {
    /// Index of this rule in [`CssAnalysisResult::rules`].
    pub index: usize,
    /// Index of the enclosing style rule, if this rule is nested.
    pub parent_rule_index: Option<usize>,
    /// Indices into [`CssAnalysisResult::selectors`], in source order.
    pub selector_indices: Vec<usize>,
    /// Number of normal declarations in the rule body.
    pub declaration_count: usize,
    /// Number of `!important` declarations in the rule body.
    pub important_declaration_count: usize,
    /// Number of enclosing style rules (top-level rules have depth `0`).
    pub nesting_depth: usize,
    /// Location of the rule in the source.
    pub location: SourceLocation,
}

/// Aggregate counters for an analysis run.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisStats {
    /// Number of style rules.
    pub rule_count: usize,
    /// Number of selectors (a rule with `a, b` contributes two).
    pub selector_count: usize,
    /// Total number of normal declarations.
    pub declaration_count: usize,
    /// Total number of `!important` declarations.
    pub important_declaration_count: usize,
    /// Number of distinct class names used by selectors.
    pub unique_class_count: usize,
    /// Number of distinct ID names used by selectors.
    pub unique_id_count: usize,
    /// Number of distinct type/tag names used by selectors.
    pub unique_tag_count: usize,
    /// Number of distinct attribute names used by selectors.
    pub unique_attribute_count: usize,
    /// Deepest style-rule nesting observed.
    pub max_nesting_depth: usize,
    /// Number of non-fatal parser warnings.
    pub warning_count: usize,
}

/// The complete result of analyzing a stylesheet.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CssAnalysisResult {
    /// All selectors found in style rules, in document order.
    pub selectors: Vec<SelectorInfo>,
    /// All style rules, in document order.
    pub rules: Vec<StyleRuleInfo>,
    /// Aggregate counters.
    pub stats: AnalysisStats,
    /// Recoverable parser problems.
    pub warnings: Vec<AnalysisWarning>,
}

impl CssAnalysisResult {
    /// Returns `true` if no style rules or selectors were found.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.rules.is_empty() && self.selectors.is_empty()
    }

    /// Returns the raw text of every selector in document order.
    pub fn selector_texts(&self) -> impl ExactSizeIterator<Item = &str> {
        self.selectors.iter().map(|selector| selector.raw.as_str())
    }

    /// Looks up a selector by its index.
    #[must_use]
    pub fn selector(&self, index: usize) -> Option<&SelectorInfo> {
        self.selectors.get(index)
    }

    /// Returns the selectors that belong to a rule.
    pub fn selectors_of<'a>(
        &'a self,
        rule: &'a StyleRuleInfo,
    ) -> impl Iterator<Item = &'a SelectorInfo> + 'a {
        rule.selector_indices
            .iter()
            .filter_map(|index| self.selectors.get(*index))
    }

    /// Builds a frequency matrix from the analyzed selectors.
    ///
    /// This is the foundation for unused-rule detection and for ordering rules
    /// by real usage in a later optimization pass.
    #[must_use]
    pub fn usage_matrix(&self) -> UsageMatrix {
        UsageMatrix::from_selectors(&self.selectors)
    }

    /// Serializes the result to JSON.
    ///
    /// # Errors
    ///
    /// Returns a `serde_json` error if the value cannot be serialized. This is
    /// not expected for the types in this crate.
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Serializes the result to pretty-printed JSON.
    ///
    /// # Errors
    ///
    /// Returns a `serde_json` error if the value cannot be serialized.
    pub fn to_json_pretty(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    /// Deserializes a result from JSON.
    ///
    /// # Errors
    ///
    /// Returns a `serde_json` error if the input is not a valid result.
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Returns the distinct class names used by the stylesheet.
    #[must_use]
    pub fn class_names(&self) -> BTreeSet<&str> {
        self.selectors
            .iter()
            .flat_map(|selector| selector.classes.iter().map(String::as_str))
            .collect()
    }

    /// Returns the distinct ID names used by the stylesheet.
    #[must_use]
    pub fn id_names(&self) -> BTreeSet<&str> {
        self.selectors
            .iter()
            .flat_map(|selector| selector.ids.iter().map(String::as_str))
            .collect()
    }

    /// Returns the distinct type/tag names used by the stylesheet.
    #[must_use]
    pub fn tag_names(&self) -> BTreeSet<&str> {
        self.selectors
            .iter()
            .flat_map(|selector| selector.tags.iter().map(String::as_str))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn specificity_round_trips_packed_layout() {
        let specificity = Specificity::new(2, 3, 4);
        assert_eq!(Specificity::from_packed(specificity.packed()), specificity);
    }

    #[test]
    fn specificity_decodes_lightningcss_layout() {
        assert_eq!(
            Specificity::from_packed((1 << 20) | (2 << 10) | 3),
            Specificity::new(1, 2, 3)
        );
    }

    #[test]
    fn result_serializes_with_javascript_friendly_keys() {
        let result = CssAnalysisResult {
            stats: AnalysisStats {
                rule_count: 1,
                ..AnalysisStats::default()
            },
            ..CssAnalysisResult::default()
        };

        let json = result.to_json().expect("serializes");
        assert!(json.contains("\"ruleCount\":1"));
        assert_eq!(
            CssAnalysisResult::from_json(&json).expect("deserializes"),
            result
        );
    }

    #[test]
    fn selector_helpers_are_case_insensitive_for_tags() {
        let selector = SelectorInfo {
            tags: vec!["DIV".to_string()],
            ..SelectorInfo::default()
        };

        assert!(selector.has_tag("div"));
        assert!(!selector.has_tag("span"));
    }
}
