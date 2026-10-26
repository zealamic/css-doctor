<div align="center">

```text
   ┌─────────────────────────────────────┐
   │   css-doctor  ·  Rust + LightningCSS │
   │   优化 · 按需分割 · 死码消除         │
   └─────────────────────────────────────┘
```

# @zealamic/css-doctor

**面向现代 JavaScript 运行时的高性能 CSS 优化、按路由分割与死码消除引擎。**

[![npm version](https://img.shields.io/npm/v/@zealamic/css-doctor-vite.svg)](https://www.npmjs.com/package/@zealamic/css-doctor-vite)
[![build](https://img.shields.io/badge/build-passing-brightgreen.svg)](#验证)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![bun](https://img.shields.io/badge/bun-supported-f472b6?logo=bun&logoColor=white)](https://bun.sh)
[![deno](https://img.shields.io/badge/deno-v2-000000?logo=deno&logoColor=white)](https://deno.com)

[English](./README.md) | [Tiếng Việt](./README_VI.md) | [简体中文](./README_CN.md)

</div>

---

## 目录

- [为什么选择 css-doctor](#为什么选择-css-doctor)
- [核心特性](#核心特性)
- [架构](#架构)
- [支持矩阵](#支持矩阵)
- [快速开始](#快速开始)
- [框架配置](#框架配置)
- [配置参数](#配置参数)
- [CSS 交付模型](#css-交付模型)
- [原生二进制](#原生二进制)
- [重要注意事项与最佳实践](#重要注意事项与最佳实践)
- [验证](#验证)
- [许可证](#许可证)

---

## 为什么选择 css-doctor

大多数 CSS 流水线只做 minify。大型应用仍会为当前路由发送未使用的选择器、
重复的 CSS 变量以及过大的全局样式表。`css-doctor` 分析**真实的
路由/class 使用关系**，并执行两个独立优化层级：

1. **语义层**：页面覆盖率（page coverage），划分 common/page/dead。
2. **物理层**：按字节预算分割，并隔离 CSS 变量。

引擎使用 Rust 和 LightningCSS AST 实现，通过 NAPI-RS 暴露给 Node.js。
输出 CSS 带有内容哈希和分块名称，因此宿主 bundler 可以保持原有的缓存和部署
模型。

---

## 核心特性

### Rust LightningCSS 内核

以原生速度解析、分析、转换和序列化 CSS AST。Node.js API 是轻量的 NAPI-RS
桥接层；所有适配器共享同一个 `optimizeCss` 流水线，不重复实现分割算法。

### 按覆盖率分割（Page-Coverage Splitting）

为每个路由构建 selector/class 使用矩阵，并根据覆盖率分类：

- **common**：出现在至少 `minPageRatio` 比例的页面中；
- **page-specific**：只出现在较少页面中；
- **dead**：没有页面使用。

不含 class 的 selector（`:root`、`html`、`body`、reset）始终属于 common。
`forceCommon` 可强制把关键 selector 保留在公共 bundle 中。

### 体积预算（Size-Budget Enforcement）

当公共样式表超过 `maxChunkSize` 时，在顶层 AST rule 边界切分。`@media`、
`@supports`、`@keyframes` 等条件块保持完整。单个超大 rule 会单独输出并标记
为 `oversized`，不会从中间截断。

### 变量隔离（Variables Isolation）

在物理分割前，把 `:root` 自定义属性和 Tailwind CSS v4 `@theme` token 提取到
独立的小变量 chunk。浏览器可以长期缓存该 chunk，而路由 CSS 可以独立更新。

### 死码消除（Dead Code Elimination）

删除没有任何路由使用的 selector。终端报告会显示每个资源的死码数量、覆盖率
矩阵和 chunk 分配结果。

### 安全边界（Safety Boundary）

绝不重命名或重写：

- CSS Modules：`*.module.css`、`*.module.scss`、`*.module.sass`、`*.module.less`；
- Vue scoped：`data-v-*`；
- Svelte scoped：`svelte-*`；
- Astro scoped island：`data-astro-cid-*`；
- Ant Design、Emotion/MUI、Chakra UI 的运行时 CSS-in-JS。

页面 loader、common import 和输出资源都会保留框架 class hash 与运行时
selector。

---

## 架构

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

### 两类适配器

**构建期 bundler 插件**

- `@zealamic/css-doctor-vite` — Vite、Vue、Svelte、React、Astro、
  TanStack Start、TanStack Router，以及所有基于 Vite 的框架。
- `@zealamic/css-doctor-next` — Next.js App Router 与 Pages Router。
- `@zealamic/css-doctor-rsbuild` — Rsbuild 与 Rspack。
- `@zealamic/css-doctor-nuxt` — Nuxt 4 官方模块。

这些适配器在构建阶段完成全部 CSS 优化，实现**零运行时开销**。Remix 3 的
Runtime Middleware 是例外：它在资源请求阶段执行，但会缓存优化结果。

这些适配器可以使用完整构建图：

- `pageCoverage`
- `sizeBudget`
- `isolateVariables`
- `minify`
- 死码消除
- 终端诊断报告

**运行时中间件**

- `@zealamic/css-doctor-remix` — Remix 3 Asset Server 中间件。

Remix 通过 `createAssetServer` 提供资源，没有构建期的 page/CSS 依赖图。
因此该 wrapper 支持 `sizeBudget`、`isolateVariables`、`minify` 和 LRU
响应缓存，但**不支持 `pageCoverage`**。

---

## 支持矩阵

| 适配器 | 生态 | Page coverage | Size budget | Variables isolation | Dead code | 执行阶段 |
| --- | --- | --- | --- | --- | --- | --- |
| `@zealamic/css-doctor-vite` | Vite、React、Vue、Svelte、TanStack Start/Router | ✅ | ✅ | ✅ | ✅ | 构建期 |
| `@zealamic/css-doctor-vite` | Astro 通过 Vite integration | ✅ | ✅ | ✅ | ✅ | 构建期 |
| `@zealamic/css-doctor-nuxt` | Nuxt 4 | ✅ | ✅ | ✅ | ✅ | 构建期 client |
| `@zealamic/css-doctor-next` | Next.js App/Pages Router | ✅ | ✅ | ✅ | ✅ | 构建期 client |
| `@zealamic/css-doctor-rsbuild` | Rsbuild / Rspack | ✅ | ✅ | ✅ | ✅ | 构建期 |
| `@zealamic/css-doctor-remix` | Remix 3 asset server | ❌ | ✅ | ✅ | ❌ | 运行时中间件 |

### Remix 3 说明

Remix 3 不使用静态 bundler 处理应用 CSS。资源由 `remix/assets` 的
`createAssetServer` 提供。`withCssDoctorAssets` 包装该 server，优化成功的
`text/css` 响应，并通过 URL、ETag 和内容哈希缓存结果。

中间件有意**不执行 page coverage**，因为请求时没有可靠的 route-to-CSS
依赖图。它使用 `sizeBudget`、`isolateVariables`、`minify` 和 LRU 缓存。
请按路由加载样式表，不要把全部 module 硬编码到 document head。

---

## 快速开始

### 安装

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

选择与运行时对应的适配器包：

| 适配器 | 安装 |
| --- | --- |
| Vite / Astro / TanStack | `pnpm add -D @zealamic/css-doctor-vite` |
| Next.js | `pnpm add -D @zealamic/css-doctor-next` |
| Rsbuild / Rspack | `pnpm add -D @zealamic/css-doctor-rsbuild` |
| Nuxt 4 | `pnpm add -D @zealamic/css-doctor-nuxt` |
| Remix 3 | `pnpm add @zealamic/css-doctor-remix` |

Native binding 会作为传递依赖安装。在受支持的 prebuilt 平台上不需要 Rust
toolchain。

### 环境要求

| Runtime | 支持 |
| --- | --- |
| Node.js | 20 及以上 |
| Bun | 当前稳定版 |
| Deno | v2 |
| CSS | 兼容 LightningCSS 的 CSS、Tailwind v4、通过宿主处理的 Sass/SCSS |

---

## 框架配置

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

同样的 `cssDoctor` 插件也适用于 `@vitejs/plugin-vue`、
`@sveltejs/vite-plugin-svelte` 或 `@tanstack/react-start`。使用 lazy route
chunk 才能让 page coverage 有意义：

```tsx
const PageDashboard = lazy(() => import("./pages/page-dashboard"));
const PageSettings = lazy(() => import("./pages/page-settings"));
```

### Astro

Astro 基于 Vite，在 `astro.config.mjs` 中注册插件：

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

Astro 的 Vite build 在 `generateBundle` 阶段没有最终 HTML。请在
`astro:build:done` 中注入 common/page CSS link，或使用仓库中的 Astro
integration 示例。

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

Wrapper 保留原有 `webpack` callback，仅作用于 production client 编译。
CSS Modules 会自动跳过。公共 chunk 通过 `@import` wrapper 暴露，因此 Next
现有 HTML/manifest link 仍然有效。

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

Nuxt 模块仅在生产 client build 运行，跳过 Vue scoped styles，并用有序
`@import` 包装分割后的公共 chunk，确保 Nitro 渲染的 HTML 仍能加载变量和公共
CSS。

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

按 action 加载页面样式，不要把每个 module 都放进 document head：

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

## 配置参数

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `pageCoverage.enabled` | `boolean` | `true` | 启用基于路由的 common/page/dead 分类。 |
| `pageCoverage.minPageRatio` | `number` | `0.5` | 进入 common 的最小页面覆盖率（`0.0`–`1.0`）。 |
| `pageCoverage.forceCommon` | `string[]` | `[]` | 强制保留在 common chunk 的 selector/class。 |
| `sizeBudget.enabled` | `boolean` | `true` | 启用按字节预算分割。 |
| `sizeBudget.maxChunkSize` | `number` | `60 * 1024` | 每个 chunk 的最大序列化字节数。Nuxt 模块默认 `30 * 1024`。 |
| `sizeBudget.isolateVariables` | `boolean` | `true` | 在分割前隔离 `:root` 和 `@theme` 变量。 |
| `minify` | `boolean` | production/build 值 | 使用 LightningCSS minify 输出。 |
| `report` | `boolean` | `true` | 在终端打印覆盖率矩阵和 chunk 信息。 |
| `exclude` | `(string \| RegExp)[]` | CSS Modules 安全规则 | 跳过匹配的资源；各适配器支持程度不同，安全跳过始终生效。 |
| `include` | `(string \| RegExp)[]` | 全部 CSS 资源 | 限定处理的资源（Vite）。 |
| `pageUsage` | `Record<string, string[]>` | `{}` | 为静态图之外的内容显式提供 class 使用信息。 |
| `onDiagnostics` | `(result) => void \| Promise<void>` | — | 构建后接收完整诊断数据。 |

### Remix 运行时参数

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `sizeBudget.enabled` | `boolean` | `true` | 启用服务端 CSS 分割。 |
| `sizeBudget.maxChunkSize` | `number` | `60 * 1024` | 单 chunk 最大字节数。 |
| `sizeBudget.isolateVariables` | `boolean` | `true` | 分割前隔离变量。 |
| `minify` | `boolean` | `NODE_ENV === "production"` | 压缩优化后的 CSS。 |
| `cache.enabled` | `boolean` | `true` | 启用 LRU 优化响应缓存。 |
| `cache.maxEntries` | `number` | `100` | 最大缓存响应数。 |
| `exclude` | `(string \| RegExp)[]` | `[]` | 额外需要跳过的 URL 模式。 |

---

## CSS 交付模型

| 适配器 | Common CSS | Page CSS | HTML/manifest 行为 |
| --- | --- | --- | --- |
| Vite | 注入 link 或 emit common chunk | Loader 前置到 page JS | HTML 保留正常 link |
| Astro | 在 `astro:build:done` 注入 | Integration 按路由注入 link | Astro 页面获得显式 link |
| Nuxt 4 | Entry CSS import common chunk | 按 page chunk 加载 | Nitro HTML link entry |
| Next.js | 原资源中的 `@import` wrapper | Page JS 中的 loader | Next manifest 保持完整 |
| Rsbuild | Emit/更新资源 | Plugin 输出 chunk | Rsbuild HTML/manifest 管理 link |
| Remix 3 | 在单个响应中拼接 | 每个 document route 的 link | Middleware 返回优化后的 CSS |

页面 CSS 应该按路由加载。不要把全部 module 硬编码到全局 document 中。

---

## 原生二进制

`@zealamic/css-doctor-binding` 为受支持平台提供预构建 NAPI 二进制。匹配
prebuilt 平台时不需要 Rust toolchain。

| 平台 | 架构 | Target |
| --- | --- | --- |
| macOS | Apple Silicon | `darwin-arm64` |
| macOS | Intel | `darwin-x64` |
| Linux | x64 glibc | `linux-x64-gnu` |
| Linux | x64 musl | `linux-x64-musl` |
| Windows | x64 MSVC | `win32-x64-msvc` |

其他平台需要使用 Rust toolchain 和 `@napi-rs/cli` 从源码构建 binding。

---

## 重要注意事项与最佳实践

### Tailwind CSS v4 与 Sass

绝不要把 Tailwind 指令放进 `.scss` 文件。Sass 可能在 `@tailwindcss/vite`
运行前吞掉或错误编译 `@import "tailwindcss"` 与 `@theme`。

正确拆分：

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

先 import 纯 CSS，再 import SCSS：

```ts
import "./styles/app.css";
import "./styles/styles-custom.scss";
```

### CSS Modules 与 scoped styles

引擎默认保护 CSS Modules 和框架 scoped CSS。不要把模块 class 加入
`forceCommon`。不要重写 Vue `data-v-*`、Svelte `svelte-*`、Astro
`data-astro-cid-*`，也不要修改 Emotion/Antd 的运行时 style tag。

### 第三方 UI 库

Ant Design、MUI、Chakra 的大部分样式通过 CSS-in-JS 在运行时注入，不存在于
Vite 静态 CSS 资源中。CSS Doctor 可以通过 lazy route 分割它们的 JavaScript
chunk，但不能分割运行时注入的 `<style>`。使用这些库测试 `sizeBudget` 时，
请添加静态 CSS fixture。

### Remix 3 document shell

不要在 `document.tsx` 中硬编码所有 CSS Module 的 link。只通过 controller
props 传入当前 route 所需的 stylesheet，避免在 home route 加载
dashboard/settings CSS。

### NuxtLink prefetch

Nuxt 默认 prefetch 被 link 的页面。预取时可能执行 page CSS loader，从而加载
其他 route 的 CSS。测试路由隔离时，使用 `no-prefetch` 或关闭 prefetch。

### 动态 class

静态扫描无法解析
`` className={`text-${color}`} `` 或 CSS Module 动态查找。必须保留这些 class
时，使用 `pageUsage` 或 `forceCommonSelectors`。

### 错误边界

构建期适配器和 Remix 运行时中间件绝不能让宿主崩溃。解析、分割、callback 或
reporter 出错时，记录 warning 并返回原始 CSS 或原始 HTTP response。

---

## 验证

仓库使用 Turborepo 管理 Node 任务，使用 Cargo 管理 Rust 任务：

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

在执行 TypeScript integration test 前构建 native binding：

```bash
pnpm --filter @zealamic/css-doctor-binding build
```

在当前 workspace 中，native build 可能需要：

```bash
PATH="$HOME/.cargo/bin:$PATH" \
CARGO_HOME=/tmp/css-doctor-cargo-home \
CARGO_TARGET_DIR=/tmp/css-doctor-target \
pnpm build
```

Example 被排除在依赖监控之外。请使用真实 example 验证适配器：

```bash
pnpm --filter astro-tailwind-sass build
pnpm --filter nuxt-tailwind-sass build
pnpm --filter remix-tailwind-sass build
pnpm --filter vite-react-3rd-ui build
```

---

## 各包文档

每个包的 README 都包含英文、越南文和简体中文的切换链接。

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

## 许可证

MIT。见 [LICENSE](./LICENSE)。
