//! Selector usage frequency matrix.
//!
//! The matrix counts how often a selector, class, ID, tag, attribute or pseudo
//! selector appears in a stylesheet. It is intentionally independent from the
//! HTML side: an embedder can combine it with a set of symbols found in markup
//! to detect dead CSS (see [`UsageMatrix::unused_classes`] and
//! [`UsageMatrix::unused_ids`]).
//!
//! Counts are per selector. A symbol used twice in the same selector (for
//! example `.btn.btn`) is counted once because [`SelectorInfo`] de-duplicates
//! its symbol lists. The same symbol used by two different selectors counts
//! twice.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::model::{CssAnalysisResult, SelectorInfo};

/// Frequency tables extracted from analyzed selectors.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageMatrix {
    /// How many selectors use each normalized selector text.
    pub selectors: BTreeMap<String, usize>,
    /// How many selectors reference each class name.
    pub classes: BTreeMap<String, usize>,
    /// How many selectors reference each ID name.
    pub ids: BTreeMap<String, usize>,
    /// How many selectors reference each type/tag name.
    pub tags: BTreeMap<String, usize>,
    /// How many selectors reference each attribute name.
    pub attributes: BTreeMap<String, usize>,
    /// How many selectors reference each pseudo-class name.
    pub pseudo_classes: BTreeMap<String, usize>,
    /// How many selectors reference each pseudo-element name.
    pub pseudo_elements: BTreeMap<String, usize>,
}

impl UsageMatrix {
    /// Builds a matrix from a slice of selectors.
    #[must_use]
    pub fn from_selectors(selectors: &[SelectorInfo]) -> Self {
        let mut matrix = Self::default();

        for selector in selectors {
            increment(&mut matrix.selectors, &selector.raw);
            increment_all(&mut matrix.classes, &selector.classes);
            increment_all(&mut matrix.ids, &selector.ids);
            increment_all(&mut matrix.tags, &selector.tags);
            increment_all(&mut matrix.attributes, &selector.attributes);
            increment_all(&mut matrix.pseudo_classes, &selector.pseudo_classes);
            increment_all(&mut matrix.pseudo_elements, &selector.pseudo_elements);
        }

        matrix
    }

    /// Builds a matrix directly from an analysis result.
    #[must_use]
    pub fn from_result(result: &CssAnalysisResult) -> Self {
        Self::from_selectors(&result.selectors)
    }

    /// Returns `true` when no symbols were counted.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.selectors.is_empty()
    }

    /// Returns class names that never appear in the supplied used-symbol set.
    ///
    /// This is a deliberately simple heuristic: a class is reported as unused
    /// when its name is not present in `used_classes`, even if a descendant or
    /// attribute selector could still match an element. Callers that need
    /// element-level matching should build on [`UsageMatrix::classes`] instead.
    #[must_use]
    pub fn unused_classes<'a>(&'a self, used_classes: &BTreeSet<String>) -> Vec<&'a str> {
        unused_names(&self.classes, used_classes)
    }

    /// Returns ID names that never appear in the supplied used-symbol set.
    ///
    /// See [`UsageMatrix::unused_classes`] for the heuristic's limitations.
    #[must_use]
    pub fn unused_ids<'a>(&'a self, used_ids: &BTreeSet<String>) -> Vec<&'a str> {
        unused_names(&self.ids, used_ids)
    }
}

fn increment(map: &mut BTreeMap<String, usize>, name: &str) {
    *map.entry(name.to_owned()).or_insert(0) += 1;
}

fn increment_all(map: &mut BTreeMap<String, usize>, names: &[String]) {
    for name in names {
        increment(map, name);
    }
}

fn unused_names<'a>(
    frequency: &'a BTreeMap<String, usize>,
    used: &BTreeSet<String>,
) -> Vec<&'a str> {
    frequency
        .keys()
        .filter(|name| !used.contains(name.as_str()))
        .map(String::as_str)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn selector(raw: &str, classes: &[&str], ids: &[&str]) -> SelectorInfo {
        SelectorInfo {
            raw: raw.to_owned(),
            classes: classes.iter().map(|name| (*name).to_owned()).collect(),
            ids: ids.iter().map(|name| (*name).to_owned()).collect(),
            ..SelectorInfo::default()
        }
    }

    #[test]
    fn counts_symbols_per_selector() {
        let matrix = UsageMatrix::from_selectors(&[
            selector(".btn", &["btn"], &[]),
            selector(".btn:hover", &["btn"], &[]),
            selector("#app .card", &["card"], &["app"]),
        ]);

        assert_eq!(matrix.selectors.get(".btn"), Some(&1));
        assert_eq!(matrix.classes.get("btn"), Some(&2));
        assert_eq!(matrix.classes.get("card"), Some(&1));
        assert_eq!(matrix.ids.get("app"), Some(&1));
        assert!(!matrix.is_empty());
    }

    #[test]
    fn unused_helpers_report_missing_symbols() {
        let matrix = UsageMatrix::from_selectors(&[
            selector(".btn", &["btn"], &[]),
            selector("#app", &[], &["app"]),
            selector("#legacy", &[], &["legacy"]),
        ]);
        let used_classes = BTreeSet::from(["btn".to_string()]);
        let used_ids = BTreeSet::from(["app".to_string()]);

        assert!(matrix.unused_classes(&used_classes).is_empty());
        assert_eq!(matrix.unused_ids(&used_ids), vec!["legacy"]);
    }
}
