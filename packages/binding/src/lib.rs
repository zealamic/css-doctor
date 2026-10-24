//! NAPI-RS bindings for the `css_doctor_core` analysis engine.
//!
//! The exported types mirror the core data model but use JavaScript-friendly
//! names and numeric types. [`analyze_css`] is synchronous, [`analyze_css_async`]
//! runs the same work on the libuv thread pool and returns a `Promise`, and
//! [`analyze_css_json`] returns a JSON string for callers that prefer to parse
//! the result themselves.

use std::collections::{HashMap, HashSet};

use napi::bindgen_prelude::AsyncTask;
use napi::{Env, Task};
use napi_derive::napi;
use serde::{Deserialize, Serialize};

use css_doctor_core as core;

/// The kind of a simple selector.
#[napi(string_enum = "snake_case")]
#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum JsSelectorKind {
    /// A class selector such as `.button`.
    Class,
    /// An ID selector such as `#app`.
    Id,
    /// A type/tag selector such as `section`.
    Tag,
    /// An attribute selector such as `[data-state="open"]`.
    Attribute,
    /// A pseudo-class such as `:hover`.
    PseudoClass,
    /// A pseudo-element such as `::before`.
    PseudoElement,
    /// The universal selector `*`.
    Universal,
    /// The CSS nesting selector `&`.
    Nesting,
}

/// Decoded CSS specificity.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsSpecificity {
    /// Number of ID selectors.
    pub ids: u32,
    /// Number of class, attribute and pseudo-class selectors.
    pub classes: u32,
    /// Number of type and pseudo-element selectors.
    pub types: u32,
}

/// A 1-based source location.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsSourceLocation {
    /// 1-based line number.
    pub line: u32,
    /// 1-based column number.
    pub column: u32,
}

/// A non-fatal parser warning.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsAnalysisWarning {
    /// Human-readable description of the problem.
    pub message: String,
    /// Location of the problem, when known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<JsSourceLocation>,
}

/// A selector extracted from a style rule.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsSelectorInfo {
    /// Normalized selector text.
    pub raw: String,
    /// Simple-selector kinds present in the selector.
    pub kinds: Vec<JsSelectorKind>,
    /// Class names without the leading dot.
    pub classes: Vec<String>,
    /// ID names without the leading hash.
    pub ids: Vec<String>,
    /// Local type/tag names.
    pub tags: Vec<String>,
    /// Local attribute names.
    pub attributes: Vec<String>,
    /// Pseudo-class names without the leading colon or arguments.
    pub pseudo_classes: Vec<String>,
    /// Pseudo-element names without the leading `::` or arguments.
    pub pseudo_elements: Vec<String>,
    /// Tree combinators present (`" "`, `">"`, `"+"`, `"~"`).
    pub combinators: Vec<String>,
    /// Decoded specificity.
    pub specificity: JsSpecificity,
    /// Index into `CssAnalysisResult.rules`.
    pub rule_index: u32,
    /// Number of enclosing style rules.
    pub nesting_depth: u32,
}

/// A style rule and its selectors.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsStyleRuleInfo {
    /// Index of the rule in `CssAnalysisResult.rules`.
    pub index: u32,
    /// Index of the enclosing style rule, when nested.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_rule_index: Option<u32>,
    /// Indices into `CssAnalysisResult.selectors`.
    pub selector_indices: Vec<u32>,
    /// Number of normal declarations.
    pub declaration_count: u32,
    /// Number of `!important` declarations.
    pub important_declaration_count: u32,
    /// Number of enclosing style rules.
    pub nesting_depth: u32,
    /// Location of the rule in the source.
    pub location: JsSourceLocation,
}

/// Aggregate counters for an analysis run.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsAnalysisStats {
    /// Number of style rules.
    pub rule_count: u32,
    /// Number of selectors.
    pub selector_count: u32,
    /// Total number of normal declarations.
    pub declaration_count: u32,
    /// Total number of `!important` declarations.
    pub important_declaration_count: u32,
    /// Number of distinct class names.
    pub unique_class_count: u32,
    /// Number of distinct ID names.
    pub unique_id_count: u32,
    /// Number of distinct type/tag names.
    pub unique_tag_count: u32,
    /// Number of distinct attribute names.
    pub unique_attribute_count: u32,
    /// Deepest style-rule nesting observed.
    pub max_nesting_depth: u32,
    /// Number of parser warnings.
    pub warning_count: u32,
}

/// The complete result of analyzing a stylesheet.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsCssAnalysisResult {
    /// All selectors in document order.
    pub selectors: Vec<JsSelectorInfo>,
    /// All style rules in document order.
    pub rules: Vec<JsStyleRuleInfo>,
    /// Aggregate counters.
    pub stats: JsAnalysisStats,
    /// Recoverable parser warnings.
    pub warnings: Vec<JsAnalysisWarning>,
}

/// Analyzes a CSS string synchronously.
///
/// # Errors
///
/// Rejects with a JavaScript `Error` when the stylesheet cannot be parsed at
/// all. Recoverable syntax errors are returned as `warnings` instead.
#[napi(js_name = "analyzeCss")]
pub fn analyze_css(css_content: String) -> Result<JsCssAnalysisResult, napi::Error> {
    analyze_core(&css_content)
}

/// Analyzes a CSS string on the libuv thread pool and returns a `Promise`.
///
/// This is the preferred entry point for large stylesheets because it does not
/// block the Node.js event loop.
///
/// # Errors
///
/// Rejects with a JavaScript `Error` when the stylesheet cannot be parsed.
#[napi(
    js_name = "analyzeCssAsync",
    ts_return_type = "Promise<JsCssAnalysisResult>"
)]
pub fn analyze_css_async(css_content: String) -> AsyncTask<AnalyzeCssTask> {
    AsyncTask::new(AnalyzeCssTask { css_content })
}

/// Analyzes a CSS string and returns the result as a JSON string.
///
/// The JSON shape is identical to the object returned by `analyzeCss`.
///
/// # Errors
///
/// Rejects with a JavaScript `Error` when parsing or serialization fails.
#[napi(js_name = "analyzeCssJson")]
pub fn analyze_css_json(css_content: String) -> Result<String, napi::Error> {
    let result = analyze_core(&css_content)?;
    serde_json::to_string(&result).map_err(|error| {
        napi::Error::from_reason(format!("failed to serialize CSS analysis: {error}"))
    })
}

/// Background task used by [`analyze_css_async`].
pub struct AnalyzeCssTask {
    css_content: String,
}

impl Task for AnalyzeCssTask {
    type Output = JsCssAnalysisResult;
    type JsValue = JsCssAnalysisResult;

    fn compute(&mut self) -> Result<Self::Output, napi::Error> {
        analyze_core(&self.css_content)
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue, napi::Error> {
        Ok(output)
    }
}

fn analyze_core(css_content: &str) -> Result<JsCssAnalysisResult, napi::Error> {
    core::analyze_css(css_content)
        .map(JsCssAnalysisResult::from)
        .map_err(napi::Error::from_reason)
}

fn to_u32(value: usize) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

impl From<core::SelectorKind> for JsSelectorKind {
    fn from(kind: core::SelectorKind) -> Self {
        match kind {
            core::SelectorKind::Class => Self::Class,
            core::SelectorKind::Id => Self::Id,
            core::SelectorKind::Tag => Self::Tag,
            core::SelectorKind::Attribute => Self::Attribute,
            core::SelectorKind::PseudoClass => Self::PseudoClass,
            core::SelectorKind::PseudoElement => Self::PseudoElement,
            core::SelectorKind::Universal => Self::Universal,
            core::SelectorKind::Nesting => Self::Nesting,
        }
    }
}

impl From<core::Specificity> for JsSpecificity {
    fn from(specificity: core::Specificity) -> Self {
        Self {
            ids: u32::from(specificity.ids),
            classes: u32::from(specificity.classes),
            types: u32::from(specificity.types),
        }
    }
}

impl From<core::SourceLocation> for JsSourceLocation {
    fn from(location: core::SourceLocation) -> Self {
        Self {
            line: location.line,
            column: location.column,
        }
    }
}

impl From<core::AnalysisWarning> for JsAnalysisWarning {
    fn from(warning: core::AnalysisWarning) -> Self {
        Self {
            message: warning.message,
            location: warning.location.map(JsSourceLocation::from),
        }
    }
}

impl From<core::SelectorInfo> for JsSelectorInfo {
    fn from(selector: core::SelectorInfo) -> Self {
        Self {
            raw: selector.raw,
            kinds: selector
                .kinds
                .into_iter()
                .map(JsSelectorKind::from)
                .collect(),
            classes: selector.classes,
            ids: selector.ids,
            tags: selector.tags,
            attributes: selector.attributes,
            pseudo_classes: selector.pseudo_classes,
            pseudo_elements: selector.pseudo_elements,
            combinators: selector.combinators,
            specificity: selector.specificity.into(),
            rule_index: to_u32(selector.rule_index),
            nesting_depth: to_u32(selector.nesting_depth),
        }
    }
}

impl From<core::StyleRuleInfo> for JsStyleRuleInfo {
    fn from(rule: core::StyleRuleInfo) -> Self {
        Self {
            index: to_u32(rule.index),
            parent_rule_index: rule.parent_rule_index.map(to_u32),
            selector_indices: rule.selector_indices.into_iter().map(to_u32).collect(),
            declaration_count: to_u32(rule.declaration_count),
            important_declaration_count: to_u32(rule.important_declaration_count),
            nesting_depth: to_u32(rule.nesting_depth),
            location: rule.location.into(),
        }
    }
}

impl From<core::AnalysisStats> for JsAnalysisStats {
    fn from(stats: core::AnalysisStats) -> Self {
        Self {
            rule_count: to_u32(stats.rule_count),
            selector_count: to_u32(stats.selector_count),
            declaration_count: to_u32(stats.declaration_count),
            important_declaration_count: to_u32(stats.important_declaration_count),
            unique_class_count: to_u32(stats.unique_class_count),
            unique_id_count: to_u32(stats.unique_id_count),
            unique_tag_count: to_u32(stats.unique_tag_count),
            unique_attribute_count: to_u32(stats.unique_attribute_count),
            max_nesting_depth: to_u32(stats.max_nesting_depth),
            warning_count: to_u32(stats.warning_count),
        }
    }
}

/// Configuration for page-coverage chunk splitting.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsChunkConfig {
    /// Minimum share of pages that must use a rule before it is considered
    /// common. Range: 0.0..=1.0.
    pub min_page_ratio: f64,
    /// Selectors or class names that should always stay in the common chunk.
    pub force_common_selectors: Vec<String>,
}

/// Input for [`split_css_by_pages`].
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsSplitInput {
    /// Original CSS source.
    pub css_content: String,
    /// Page/route name to class names used by that page.
    pub page_usage: HashMap<String, Vec<String>>,
    /// Splitting configuration.
    pub config: JsChunkConfig,
}

/// Usage information for one selector.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsSelectorStat {
    /// Original selector text.
    pub selector: String,
    /// Matched class occurrences across pages.
    pub total_occurrences: u32,
    /// Number of pages using the selector.
    pub page_count: u32,
    /// Fraction of pages using the selector (0..1).
    pub coverage_ratio: f64,
    /// `common`, `dead`, or `page:<name>[,<name>...]`.
    pub target_chunk: String,
}

/// Result of page-coverage chunk splitting.
#[napi(object)]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JsSplitOutput {
    /// CSS shared by pages reaching the coverage threshold, plus global rules.
    pub common_css: String,
    /// Page name to page-specific CSS.
    pub page_chunks: HashMap<String, String>,
    /// Per-selector usage matrix.
    pub stats: Vec<JsSelectorStat>,
    /// Number of dead selector occurrences removed.
    pub dead_code_count: u32,
}

/// Splits a stylesheet into common and page-specific CSS chunks.
///
/// # Errors
///
/// Rejects with a JavaScript `Error` when the configuration is invalid or the
/// stylesheet/AST cannot be processed.
#[napi]
pub fn split_css_by_pages(input: JsSplitInput) -> Result<JsSplitOutput, napi::Error> {
    let core_input = core::SplitInput {
        css_content: input.css_content,
        page_usage: input
            .page_usage
            .into_iter()
            .map(|(page, classes)| (page, classes.into_iter().collect::<HashSet<_>>()))
            .collect(),
        config: core::ChunkConfig {
            min_page_ratio: input.config.min_page_ratio as f32,
            force_common_selectors: input.config.force_common_selectors,
        },
    };

    core::split_css_by_pages(&core_input)
        .map(JsSplitOutput::from)
        .map_err(napi::Error::from_reason)
}

impl From<core::SelectorStat> for JsSelectorStat {
    fn from(stat: core::SelectorStat) -> Self {
        Self {
            selector: stat.selector,
            total_occurrences: to_u32(stat.total_occurrences),
            page_count: to_u32(stat.page_count),
            coverage_ratio: f64::from(stat.coverage_ratio),
            target_chunk: stat.target_chunk,
        }
    }
}

impl From<core::SplitOutput> for JsSplitOutput {
    fn from(output: core::SplitOutput) -> Self {
        Self {
            common_css: output.common_css,
            page_chunks: output.page_chunks,
            stats: output.stats.into_iter().map(JsSelectorStat::from).collect(),
            dead_code_count: to_u32(output.dead_code_count),
        }
    }
}

impl From<core::CssAnalysisResult> for JsCssAnalysisResult {
    fn from(result: core::CssAnalysisResult) -> Self {
        Self {
            selectors: result
                .selectors
                .into_iter()
                .map(JsSelectorInfo::from)
                .collect(),
            rules: result
                .rules
                .into_iter()
                .map(JsStyleRuleInfo::from)
                .collect(),
            stats: result.stats.into(),
            warnings: result
                .warnings
                .into_iter()
                .map(JsAnalysisWarning::from)
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_a_complete_analysis_result() {
        let result = analyze_core(
            r#"
            #app .card:hover, .card--wide {
              color: red;
            }
            @media (min-width: 768px) {
              .hidden { display: none !important; }
            }
            "#,
        )
        .expect("analysis succeeds");

        assert_eq!(result.selectors.len(), 3);
        assert_eq!(result.rules.len(), 2);
        assert_eq!(result.stats.rule_count, 2);
        assert_eq!(result.stats.selector_count, 3);
        assert_eq!(result.stats.important_declaration_count, 1);
        assert_eq!(
            result.selectors[0].kinds,
            vec![
                JsSelectorKind::Id,
                JsSelectorKind::Class,
                JsSelectorKind::PseudoClass
            ]
        );
        assert_eq!(result.selectors[0].specificity.ids, 1);
        assert_eq!(result.selectors[0].specificity.classes, 2);
        assert_eq!(result.selectors[1].rule_index, 0);
        assert_eq!(result.rules[1].parent_rule_index, None);
    }

    #[test]
    fn json_output_matches_the_object_shape() {
        let result = analyze_core(".btn { color: red; }").expect("analysis succeeds");
        let json = serde_json::to_value(&result).expect("serializes");

        assert_eq!(json["selectors"][0]["raw"], ".btn");
        assert_eq!(json["selectors"][0]["kinds"][0], "class");
        assert_eq!(json["selectors"][0]["ruleIndex"], 0);
        assert_eq!(json["stats"]["ruleCount"], 1);
    }

    #[test]
    fn reports_recoverable_errors_as_warnings() {
        let result = analyze_core(".valid { color red; }").expect("analysis recovers");

        assert_eq!(result.rules.len(), 1);
        assert_eq!(result.warnings.len(), 1);
        assert_eq!(result.stats.warning_count, 1);
        assert!(result.warnings[0].location.is_some());
    }

    #[test]
    fn maps_page_splitting_output_to_javascript_objects() {
        let input = JsSplitInput {
            css_content: ".shared { color: red; } .about { color: blue; } .dead { display: none; }"
                .to_string(),
            page_usage: HashMap::from([
                ("home".to_string(), vec!["shared".to_string()]),
                (
                    "about".to_string(),
                    vec!["shared".to_string(), "about".to_string()],
                ),
                ("contact".to_string(), vec!["shared".to_string()]),
            ]),
            config: JsChunkConfig {
                min_page_ratio: 0.5,
                force_common_selectors: Vec::new(),
            },
        };

        let output = split_css_by_pages(input).expect("split succeeds");

        assert!(output.common_css.contains(".shared"));
        assert!(output.page_chunks["about"].contains(".about"));
        assert!(!output.common_css.contains(".dead"));
        assert_eq!(output.dead_code_count, 1);
        assert_eq!(output.stats.len(), 3);

        let about = output
            .stats
            .iter()
            .find(|stat| stat.selector == ".about")
            .expect("about stat");
        assert_eq!(about.page_count, 1);
        assert_eq!(about.target_chunk, "page:about");
        assert!((about.coverage_ratio - 0.3333).abs() < 0.0001);
    }

    #[test]
    fn reports_split_configuration_errors() {
        let input = JsSplitInput {
            css_content: String::new(),
            page_usage: HashMap::new(),
            config: JsChunkConfig {
                min_page_ratio: 2.0,
                force_common_selectors: Vec::new(),
            },
        };

        let error = split_css_by_pages(input).expect_err("invalid config fails");
        assert!(error.to_string().contains("min_page_ratio"));
    }

    #[test]
    fn empty_css_produces_an_empty_result() {
        let result = analyze_core("").expect("empty CSS is valid");

        assert!(result.selectors.is_empty());
        assert!(result.rules.is_empty());
        assert_eq!(
            result.stats,
            JsAnalysisStats {
                rule_count: 0,
                selector_count: 0,
                declaration_count: 0,
                important_declaration_count: 0,
                unique_class_count: 0,
                unique_id_count: 0,
                unique_tag_count: 0,
                unique_attribute_count: 0,
                max_nesting_depth: 0,
                warning_count: 0,
            }
        );
        assert!(result.warnings.is_empty());
    }
}
