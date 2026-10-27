<div align="center">

# @zealamic/css-doctor-binding

**Native NAPI-RS bridge for the css-doctor LightningCSS engine.**

Version 1.0.0-beta-2

[English](./README.md) | [Tiếng Việt](./README_VI.md) | [简体中文](./README_CN.md)

</div>

---

## Installation

```bash
pnpm add @zealamic/css-doctor-binding
```

## Usage

```ts
import { analyzeCss, optimizeCss } from "@zealamic/css-doctor-binding";

const analysis = analyzeCss(".card { color: red; }");

const result = optimizeCss({
  cssContent: ".card { color: red; } :root { --brand: red; }",
  pageUsage: { home: ["card"] },
  pageCoverage: { enabled: true, minPageRatio: 0.5 },
  sizeBudget: { enabled: true, maxChunkSize: 40 * 1024, isolateVariables: true },
  minify: true,
});

console.log(analysis.stats.selectorCount);
console.log(result.chunks);
```

## Safety and limitations

- Prebuilt binaries cover darwin-arm64, darwin-x64, linux-x64-gnu, linux-x64-musl, and win32-x64-msvc.
- The native API is low-level; prefer @zealamic/css-doctor-vite, next, rsbuild, nuxt, or remix for application builds.
- Never edit generated index.js, index.d.ts, index.d.cts, or *.node files by hand.

## Full documentation

Project README: [English](../../README.md) | [Tiếng Việt](../../README_VI.md) | [简体中文](../../README_CN.md)
