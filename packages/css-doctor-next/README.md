<div align="center">

# @zealamic/css-doctor-next

**Next.js App Router and Pages Router integration for css-doctor.**

Version 1.0.0-beta-2

[English](./README.md) | [Tiếng Việt](./README_VI.md) | [简体中文](./README_CN.md)

</div>

---

## Installation

```bash
pnpm add -D @zealamic/css-doctor-next
```

## Usage

```ts
import { withCssDoctor } from "@zealamic/css-doctor-next";

export default withCssDoctor(
  { reactStrictMode: true },
  {
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
  },
);
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

- Preserves the existing webpack callback and applies only to the production client build.
- CSS Modules are skipped automatically; common chunks remain linked through @import wrappers.
- Peer range next >=13 is intentionally broad.

## Full documentation

Project README: [English](../../README.md) | [Tiếng Việt](../../README_VI.md) | [简体中文](../../README_CN.md)
