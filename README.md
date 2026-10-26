<div align="center">

```text
   ┌─────────────────────────────────────┐
   │   css-doctor  ·  Rust + LightningCSS │
   │   optimize · split · eliminate       │
   └─────────────────────────────────────┘
```

# @zealamic/css-doctor

**High-performance CSS optimization, page-aware splitting, and dead-code elimination for modern JavaScript runtimes.**

[![npm version](https://img.shields.io/npm/v/@zealamic/css-doctor-vite.svg)](https://www.npmjs.com/package/@zealamic/css-doctor-vite)
[![build](https://img.shields.io/badge/build-passing-brightgreen.svg)](#verification)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![bun](https://img.shields.io/badge/bun-supported-f472b6?logo=bun&logoColor=white)](https://bun.sh)
[![deno](https://img.shields.io/badge/deno-v2-000000?logo=deno&logoColor=white)](https://deno.com)

[English](./README.md) | [Tiếng Việt](./README_VI.md) | [简体中文](./README_CN.md)

</div>

---

## Table of contents

- [Why css-doctor](#why-css-doctor)
- [Key features](#key-features)
- [Architecture](#architecture)
- [Support matrix](#support-matrix)
- [Quick start](#quick-start)
- [Framework setup](#framework-setup)
- [Configuration reference](#configuration-reference)
- [Delivery model](#delivery-model)
- [Native binaries](#native-binaries)
- [Important caveats and best practices](#important-caveats-and-best-practices)
- [Verification](#verification)
- [License](#license)

---

## Why css-doctor

Most CSS pipelines stop at minification. Large applications still ship selectors
for routes the current page never uses, duplicate variables, and oversized
global stylesheets. `css-doctor` analyzes the **actual route/class usage graph**
and applies two independent optimization tiers:

1. **Semantic tier**: page coverage, common/page/dead classification.
2. **Physical tier**: byte-budget splitting and CSS-variable isolation.

The engine is implemented in Rust with LightningCSS AST parsing and exposed to
Node.js through NAPI-RS. Optimized CSS is emitted with source-aware chunk names
and content hashes, so the host bundler keeps its normal caching and deployment
model.

---

## Key features

### Rust LightningCSS core

Parse, analyze, transform, and serialize CSS with the LightningCSS AST at native
speed. The Node.js API is a thin NAPI-RS bridge; bundler adapters call the same
`optimizeCss` pipeline instead of reimplementing splitting logic.

### Page-coverage splitting

Build a selector/class usage matrix for every route. A selector is assigned to:

- **common** when it appears in at least `minPageRatio` of pages;
- **page-specific** when it appears in fewer pages;
- **dead** when no page uses it.

Selectors without classes (`:root`, `html`, `body`, resets) are always global.
`forceCommon` keeps critical selectors in the shared bundle regardless of
coverage.

### Size-budget enforcement

When a common stylesheet exceeds `maxChunkSize`, split it at top-level AST rule
boundaries. Conditional blocks such as `@media`, `@supports`, and
`@keyframes` remain intact. A single oversized rule is emitted alone and marked
as `oversized` rather than being cut mid-rule.

### Variables isolation

Extract `:root` custom properties and Tailwind CSS v4 `@theme` tokens into a
small variables chunk before physical splitting. Browsers can cache that chunk
independently while route CSS changes.

### Dead-code elimination

Remove selectors that no route uses. Dead-code counts are reported per asset
and in the terminal reporter, which also shows the coverage matrix and chunk
assignment.

### Safety boundary

Never rewrite:

- CSS Modules: `*.module.css`, `*.module.scss`, `*.module.sass`, `*.module.less`;
- Vue scoped styles: `data-v-*`;
- Svelte scoped styles: `svelte-*`;
- Astro scoped islands: `data-astro-cid-*`;
- runtime CSS-in-JS from Ant Design, Emotion/MUI, and Chakra UI.

Page loaders, common imports, and emitted assets preserve framework class
hashes and runtime selectors.

---

## Architecture

```text
                       ┌──────────────────────────────┐
Bundler / runtime ───► │  adapter                     │
                       │  Vite / Next / Rsbuild /     │
                       │  Nuxt / Remix                │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │  @zealamic/css-doctor-binding│
                       │  NAPI-RS bridge              │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │  crates/core                 │
                       │  LightningCSS AST engine     │
                       └──────────────┬───────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
       page coverage            size budget             minification
       + dead code              + variable isolation
```

### Two adapter families

**Build-time bundler plugins**

- `@zealamic/css-doctor-vite` — Vite, Vue, Svelte, React, Astro, TanStack Start,
  TanStack Router, and any Vite-based framework.
- `@zealamic/css-doctor-next` — Next.js App Router and Pages Router.
- `@zealamic/css-doctor-rsbuild` — Rsbuild and Rspack.
- `@zealamic/css-doctor-nuxt` — official Nuxt 4 module.

These adapters can use the full build graph:

- `pageCoverage`
- `sizeBudget`
- `isolateVariables`
- `minify`
- dead-code elimination
- terminal diagnostics

**Runtime middleware**

- `@zealamic/css-doctor-remix` — Remix 3 asset server middleware.

Remix serves assets through `createAssetServer` and has no build-time page/CSS
dependency graph. Its wrapper therefore supports `sizeBudget`,
`isolateVariables`, `minify`, and an LRU response cache, but **not
`pageCoverage`**.

---

## Support matrix

| Adapter | Ecosystem | Page coverage | Size budget | Variables isolation | Dead code | Execution |
| --- | --- | --- | --- | --- | --- | --- |
| `@zealamic/css-doctor-vite` | Vite, React, Vue, Svelte, TanStack Start/Router | ✅ | ✅ | ✅ | ✅ | Build-time |
| `@zealamic/css-doctor-vite` | Astro via Vite integration | ✅ | ✅ | ✅ | ✅ | Build-time |
| `@zealamic/css-doctor-nuxt` | Nuxt 4 | ✅ | ✅ | ✅ | ✅ | Build-time client |
| `@zealamic/css-doctor-next` | Next.js App/Pages Router | ✅ | ✅ | ✅ | ✅ | Build-time client |
| `@zealamic/css-doctor-rsbuild` | Rsbuild / Rspack | ✅ | ✅ | ✅ | ✅ | Build-time |
| `@zealamic/css-doctor-remix` | Remix 3 asset server | ❌ | ✅ | ✅ | ❌ | Runtime middleware |

### Remix 3 note

Remix 3 does not use a static bundler for application CSS. Assets are served by
`createAssetServer` from `remix/assets`. `withCssDoctorAssets` wraps that server,
optimizes successful `text/css` responses, and caches results by URL, ETag, and
content hash.

The middleware intentionally does **not** run page coverage because there is no
route-to-CSS graph at request time. It uses `sizeBudget`, `isolateVariables`,
`minify`, and an LRU cache. Use per-route stylesheet links instead of hardcoding
every module in the document head.

---

## Quick start

### Installation

```bash
# pnpm
pnpm add -D @zealamic/css-doctor-vite

# npm
npm install -D @zealamic/css-doctor-vite

# yarn
yarn add -D @zealamic/css-doctor-vite

# bun
bun add -d @zealamic/css-doctor-vite

# deno
deno add npm:@zealamic/css-doctor-vite
```

Use the adapter package that matches your runtime:

| Adapter | Install |
| --- | --- |
| Vite / Astro / TanStack | `pnpm add -D @zealamic/css-doctor-vite` |
| Next.js | `pnpm add -D @zealamic/css-doctor-next` |
| Rsbuild / Rspack | `pnpm add -D @zealamic/css-doctor-rsbuild` |
| Nuxt 4 | `pnpm add -D @zealamic/css-doctor-nuxt` |
| Remix 3 | `pnpm add @zealamic/css-doctor-remix` |

The native binding is installed transitively. You do **not** need a Rust
toolchain for a supported prebuilt platform.

### Requirements

| Runtime | Support |
| --- | --- |
| Node.js | 20 or newer |
| Bun | Current stable |
| Deno | v2 |
| CSS | LightningCSS-compatible CSS, Tailwind v4, Sass/SCSS via the host pipeline |

---

## Framework setup

### Vite / React / Vue / Svelte / TanStack Start

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cssDoctor } from "@zealamic/css-doctor-vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
      minify: true,
      report: true,
    }),
  ],
});
```

Use the same `cssDoctor` plugin with `@vitejs/plugin-vue`,
`@sveltejs/vite-plugin-svelte`, or `@tanstack/react-start`. Lazy route chunks
make page coverage meaningful:

```tsx
const PageDashboard = lazy(() => import("./pages/page-dashboard"));
const PageSettings = lazy(() => import("./pages/page-settings"));
```

### Astro

Astro runs on Vite. Register the plugin in `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import { cssDoctor } from "@zealamic/css-doctor-vite";

export default defineConfig({
  vite: {
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
  },
});
```

Astro's Vite build does not expose final HTML during `generateBundle`; link
common and page CSS in `astro:build:done` or with the documented Astro fixture
integration.

### Next.js

```js
// next.config.mjs
import { withCssDoctor } from "@zealamic/css-doctor-next";

export default withCssDoctor(
  {
    reactStrictMode: true,
  },
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
    minify: true,
    report: true,
  },
);
```

The wrapper preserves the existing `webpack` callback and applies only to the
production client compilation. CSS Modules are skipped automatically. Common
chunks are exposed through `@import` wrappers so Next's HTML/manifest links
continue to work.

### Rsbuild / Rspack

```ts
// rsbuild.config.ts
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginCssDoctor } from "@zealamic/css-doctor-rsbuild";

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginCssDoctor({
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
      minify: true,
      report: true,
    }),
  ],
});
```

### Nuxt 4

```ts
// nuxt.config.ts
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["@zealamic/css-doctor-nuxt"],
  css: [
    "~/assets/styles-tailwind.css",
    "~/assets/styles-custom.scss",
  ],
  cssDoctor: {
    pageCoverage: {
      enabled: true,
      minPageRatio: 0.5,
      forceCommon: [".app-shell", ".nav-link"],
    },
    sizeBudget: {
      enabled: true,
      maxChunkSize: 30 * 1024,
      isolateVariables: true,
    },
    minify: true,
    report: true,
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
```

The Nuxt module runs only for the production client build, skips Vue scoped
styles, and wraps split common chunks with ordered `@import` statements so
Nitro-rendered HTML still loads variables and common CSS.

### Remix 3

```ts
// app/assets.ts
import { createAssetServer } from "remix/assets";
import { withCssDoctorAssets } from "@zealamic/css-doctor-remix";

const baseAssets = createAssetServer({
  basePath: "/assets",
  rootDir: process.cwd(),
  allowFiles: ["app/**/public/**", "app/routes.ts"],
  allowPackages: ["remix"],
});

export const assets = withCssDoctorAssets(baseAssets, {
  sizeBudget: {
    enabled: true,
    maxChunkSize: 30 * 1024,
    isolateVariables: true,
  },
  minify: process.env.NODE_ENV === "production",
  cache: {
    enabled: true,
    maxEntries: 100,
  },
  exclude: [/\.module\.(css|scss)$/],
});
```

Load page-specific styles per action instead of adding every module to the
document head:

```tsx
<Document
  title="Dashboard"
  stylesheets={["/assets/app/styles/dashboard.module.scss"]}
>
  <NavBar />
  <DashboardPage />
</Document>
```

---

## Configuration reference

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `pageCoverage.enabled` | `boolean` | `true` | Enable route-based common/page/dead classification. |
| `pageCoverage.minPageRatio` | `number` | `0.5` | Minimum page coverage (`0.0`–`1.0`) for common selectors. |
| `pageCoverage.forceCommon` | `string[]` | `[]` | Selectors or class names forced into the common chunk. |
| `sizeBudget.enabled` | `boolean` | `true` | Enable physical chunk splitting by byte size. |
| `sizeBudget.maxChunkSize` | `number` | `60 * 1024` | Maximum serialized bytes per chunk. Nuxt module default: `30 * 1024`. |
| `sizeBudget.isolateVariables` | `boolean` | `true` | Extract `:root` and `@theme` variables before splitting. |
| `minify` | `boolean` | production/build value | Minify emitted CSS with LightningCSS. |
| `report` | `boolean` | `true` | Print the terminal coverage matrix and emitted chunks. |
| `exclude` | `(string \| RegExp)[]` | CSS Modules safety rules | Skip matching CSS assets. Adapter support varies; safety skips are always applied. |
| `include` | `(string \| RegExp)[]` | all CSS assets | Restrict the adapter to matching assets (Vite). |
| `pageUsage` | `Record<string, string[]>` | `{}` | Explicit page class usage for content outside the static graph. |
| `onDiagnostics` | `(result) => void \| Promise<void>` | — | Receive the full diagnostics payload after a build. |

### Remix runtime options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `sizeBudget.enabled` | `boolean` | `true` | Enable size splitting for served CSS. |
| `sizeBudget.maxChunkSize` | `number` | `60 * 1024` | Maximum inline chunk size. |
| `sizeBudget.isolateVariables` | `boolean` | `true` | Isolate variables before splitting. |
| `minify` | `boolean` | `NODE_ENV === "production"` | Minify optimized CSS. |
| `cache.enabled` | `boolean` | `true` | Enable the LRU optimized-response cache. |
| `cache.maxEntries` | `number` | `100` | Maximum cached responses. |
| `exclude` | `(string \| RegExp)[]` | `[]` | Additional URL patterns to bypass. |

---

## Delivery model

| Adapter | Common CSS | Page CSS | HTML/manifest behavior |
| --- | --- | --- | --- |
| Vite | Injected links or emitted common chunks | Loader prepended to page JS | Host HTML keeps normal links |
| Astro | `astro:build:done` injection | Integration-injected route links | Astro pages get explicit links |
| Nuxt 4 | Entry CSS imports common chunks | Page chunk loaders | Nitro HTML links the entry |
| Next.js | `@import` wrapper in original asset | Loader in page JS | Next manifest stays intact |
| Rsbuild | Emitted/updated assets | Plugin-emitted chunks | Rsbuild HTML/manifest owns links |
| Remix 3 | Concatenated in one response | Per-route document links | Middleware returns optimized CSS |

Page-specific CSS is intentionally route-scoped. Do not hardcode every page
module into a global document shell.

---

## Native binaries

`@zealamic/css-doctor-binding` ships prebuilt NAPI binaries for the supported
platforms. A Rust toolchain is not required when a matching binary is available.

| Platform | Architecture | Target |
| --- | --- | --- |
| macOS | Apple Silicon | `darwin-arm64` |
| macOS | Intel | `darwin-x64` |
| Linux | x64 glibc | `linux-x64-gnu` |
| Linux | x64 musl | `linux-x64-musl` |
| Windows | x64 MSVC | `win32-x64-msvc` |

If your platform is not listed, build the binding from source with the Rust
toolchain and `@napi-rs/cli`.

---

## Important caveats and best practices

### Tailwind CSS v4 and Sass

Never put Tailwind directives in a `.scss` file. Sass can consume or
miscompile `@import "tailwindcss"` and `@theme` before `@tailwindcss/vite` runs.

Correct split:

```css
/* app.css */
@import "tailwindcss";

@theme {
  --color-brand: #3b82f6;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

```scss
/* styles-custom.scss */
@mixin glass {
  background: rgba(17, 24, 39, 0.7);
  border: 1px solid var(--zl-panel-border);
  border-radius: 0.75rem;
}
```

Import the pure CSS first, then SCSS:

```ts
import "./styles/app.css";
import "./styles/styles-custom.scss";
```

### CSS Modules and scoped styles

The engine protects CSS Modules and framework-scoped CSS by default. Do not
add module class names to `forceCommon`. Do not rewrite Vue `data-v-*`,
Svelte `svelte-*`, Astro `data-astro-cid-*`, or runtime Emotion/Antd style tags.

### Third-party UI libraries

Ant Design, MUI, and Chakra inject most styles at runtime through CSS-in-JS.
Their CSS is not present in Vite's static CSS assets. CSS Doctor can split their
JavaScript chunks via lazy routes, but cannot split runtime-injected `<style>`
tags. Use a static CSS fixture when testing `sizeBudget` with these libraries.

### Remix 3 document shell

Avoid hardcoded links for every CSS Module in `document.tsx`. Pass only the
stylesheets needed by the current route through controller props. This prevents
loading dashboard/settings CSS on the home route.

### NuxtLink prefetch

Nuxt prefetches linked pages by default. Page CSS loaders can execute during
prefetch and load CSS for other routes. For route-isolation testing, use
`no-prefetch` on links or disable prefetch globally.

### Dynamic classes

Static scanning cannot resolve template strings such as
`` className={`text-${color}`} `` or CSS Module lookups. Supply `pageUsage` or
`forceCommonSelectors` when these classes must be retained.

### Error boundaries

Build-time adapters and the Remix runtime middleware must never crash the host.
On parse, split, callback, or reporter failure: log a warning and return the
original CSS or original HTTP response.

---

## Verification

The repository uses Turborepo for Node tasks and Cargo for Rust tasks:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm check
pnpm lint
pnpm format:check

cargo check --workspace
cargo test --workspace
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo fmt --all -- --check
```

Build the native binding before TypeScript integration tests:

```bash
pnpm --filter @zealamic/css-doctor-binding build
```

On this workspace, native builds may require:

```bash
PATH="$HOME/.cargo/bin:$PATH" \
CARGO_HOME=/tmp/css-doctor-cargo-home \
CARGO_TARGET_DIR=/tmp/css-doctor-target \
pnpm build
```

Examples are intentionally excluded from dependency monitoring. Validate an
adapter with its real example:

```bash
pnpm --filter astro-tailwind-sass build
pnpm --filter nuxt-tailwind-sass build
pnpm --filter remix-tailwind-sass build
pnpm --filter vite-react-3rd-ui build
```

---

## Package documentation

Each package README links to its Vietnamese and Simplified Chinese translations.

| Package | README |
| --- | --- |
| `@zealamic/css-doctor-binding` | [README](packages/binding/README.md) |
| `@zealamic/css-doctor-cli` | [README](packages/cli/README.md) |
| `@zealamic/css-doctor-vite` | [README](packages/css-doctor-vite/README.md) |
| `@zealamic/css-doctor-next` | [README](packages/css-doctor-next/README.md) |
| `@zealamic/css-doctor-rsbuild` | [README](packages/css-doctor-rsbuild/README.md) |
| `@zealamic/css-doctor-nuxt` | [README](packages/css-doctor-nuxt/README.md) |
| `@zealamic/css-doctor-remix` | [README](packages/css-doctor-remix/README.md) |


---

## License

MIT. See [LICENSE](./LICENSE).
