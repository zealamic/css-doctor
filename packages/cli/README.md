<div align="center">

# @zealamic/css-doctor-cli

**Command-line diagnostics for CSS files using the native css-doctor engine.**

Version 1.0.0-beta.1

[English](./README.md) | [Tiếng Việt](./README_VI.md) | [简体中文](./README_CN.md)

</div>

---

## Installation

```bash
pnpm add -D @zealamic/css-doctor-cli
```

## Usage

```bash
# Analyze files or quoted globs
pnpm exec css-doctor check "src/**/*.css"

# Machine-readable CI output
pnpm exec css-doctor check "src/**/*.css" --json

# Warn when a file has more than 500 selectors
pnpm exec css-doctor check "src/**/*.css" --threshold 500
```

## Safety and limitations

- The binary is named css-doctor and is exposed through the package bin field.
- --json emits a stable CheckReport schema with files, issues, and summary counters.
- Exit code is non-zero for fatal setup/read/analysis failures; warnings remain visible in the report.

## Full documentation

Project README: [English](../../README.md) | [Tiếng Việt](../../README_VI.md) | [简体中文](../../README_CN.md)
