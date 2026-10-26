<div align="center">

# @zealamic/css-doctor-vite

**Vite/Rollup plugin for page-coverage and size-budget CSS optimization.**

Version 1.0.0-beta.1

[English](./README.md) | [Tiếng Việt](./README_VI.md) | [简体中文](./README_CN.md)

</div>

---

## Installation

```bash
pnpm add -D @zealamic/css-doctor-vite
```

## Usage

```ts
import { defineConfig } from "vite";
import { cssDoctor } from "@zealamic/css-doctor-vite";

export default defineConfig({
  plugins: [
    cssDoctor({
      pageCoverage: {
        enabled: true,
        minPageRatio: 0.5,
        forceCommon: [".app-shell", ".nav-link"],
      },
      sizeBudget: {
        enabled: true,
        maxChunkSize: 40 * 1024,
        isolateVariables: true,
      },
      report: true,
    }),
  ],
});
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `pageCoverage.enabled` | `true` | Enable page/class coverage classification. |
| `pageCoverage.minPageRatio` | `0.5` | Minimum ratio (0.0-1.0) for the common chunk. |
| `pageCoverage.forceCommon` | `[]` | Selectors or classes forced into common CSS. |
| `sizeBudget.enabled` | `true` | Enable byte-budget splitting. |
| `sizeBudget.maxChunkSize` | `60 * 1024` | Maximum bytes per emitted chunk. |
| `sizeBudget.isolateVariables` | `true` | Extract `:root` and `@theme` variables first. |
| `minify` | production | Minify emitted CSS with LightningCSS. |
| `report` | `true` | Print coverage and chunk diagnostics. |
| `exclude` | CSS Modules safety | Skip matching CSS assets. |

## Safety and limitations

- Supports Vite, React, Vue, Svelte, Astro, TanStack Start, and TanStack Router.
- Lazy route chunks make page coverage effective.
- CSS Modules and Vue scoped styles are protected; page CSS is loaded by a small page-chunk loader.

## Full documentation

Project README: [English](../../README.md) | [Tiếng Việt](../../README_VI.md) | [简体中文](../../README_CN.md)
