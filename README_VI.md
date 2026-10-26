<div align="center">

```text
   ┌─────────────────────────────────────┐
   │   css-doctor  ·  Rust + LightningCSS │
   │   tối ưu · phân tách · loại bỏ       │
   └─────────────────────────────────────┘
```

# @zealamic/css-doctor

**Engine tối ưu hóa CSS, phân tách theo route và loại bỏ dead code hiệu năng cao cho các runtime JavaScript hiện đại.**

[![npm version](https://img.shields.io/npm/v/@zealamic/css-doctor-vite.svg)](https://www.npmjs.com/package/@zealamic/css-doctor-vite)
[![build](https://img.shields.io/badge/build-passing-brightgreen.svg)](#kiểm-chứng)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![bun](https://img.shields.io/badge/bun-supported-f472b6?logo=bun&logoColor=white)](https://bun.sh)
[![deno](https://img.shields.io/badge/deno-v2-000000?logo=deno&logoColor=white)](https://deno.com)

[English](./README.md) | [Tiếng Việt](./README_VI.md) | [简体中文](./README_CN.md)

</div>

---

## Mục lục

- [Vì sao chọn css-doctor](#vì-sao-chọn-css-doctor)
- [Tính năng nổi bật](#tính-năng-nổi-bật)
- [Kiến trúc](#kiến-trúc)
- [Ma trận hỗ trợ](#ma-trận-hỗ-trợ)
- [Cài đặt nhanh](#cài-đặt-nhanh)
- [Cấu hình theo framework](#cấu-hình-theo-framework)
- [Tham chiếu cấu hình](#tham-chiếu-cấu-hình)
- [Cơ chế phân phối CSS](#cơ-chế-phân-phối-css)
- [Native binary](#native-binary)
- [Lưu ý quan trọng và best practice](#lưu-ý-quan-trọng-và-best-practice)
- [Kiểm chứng](#kiểm-chứng)
- [Giấy phép](#giấy-phép)

---

## Vì sao chọn css-doctor

Phần lớn CSS pipeline chỉ dừng ở minify. Ứng dụng lớn vẫn tải selector không
dùng cho route hiện tại, lặp biến CSS, và gửi stylesheet toàn cục quá lớn.
`css-doctor` phân tích **đồ thị sử dụng class theo route thực tế** và chạy hai
tầng tối ưu độc lập:

1. **Tầng ngữ nghĩa**: page coverage, phân loại common/page/dead.
2. **Tầng vật lý**: chia nhỏ theo byte budget và bóc tách biến CSS.

Engine viết bằng Rust, parse AST bằng LightningCSS, expose qua NAPI-RS. CSS đầu
ra có tên chunk và content hash, nên bundler vẫn giữ nguyên caching/deployment.

---

## Tính năng nổi bật

### Rust LightningCSS core

Parse, phân tích, biến đổi và serialize CSS bằng AST LightningCSS với tốc độ
native. API Node.js là cầu nối NAPI-RS mỏng; mọi adapter gọi chung pipeline
`optimizeCss`, không tự cài lại thuật toán split.

### Page-coverage splitting

Xây dựng ma trận class/selector theo từng page. Selector được phân loại:

- **common** nếu xuất hiện ở ít nhất `minPageRatio` số page;
- **page-specific** nếu xuất hiện ít hơn;
- **dead** nếu không page nào dùng.

Selector không có class (`:root`, `html`, `body`, reset) luôn thuộc common.
`forceCommon` giữ selector quan trọng trong bundle dùng chung.

### Size-budget enforcement

Khi stylesheet common vượt `maxChunkSize`, engine chia tại ranh giới rule
top-level. Các block điều kiện như `@media`, `@supports`, `@keyframes` được giữ
nguyên. Một rule đơn lẻ quá lớn được phát hành riêng và đánh dấu `oversized`,
không bị cắt giữa rule.

### Variables isolation

Tách `:root` custom properties và token Tailwind CSS v4 `@theme` thành chunk
biến nhỏ trước khi chia vật lý. Trình duyệt có thể cache chunk này lâu dài trong
khi CSS theo route thay đổi.

### Dead-code elimination

Loại bỏ selector không route nào dùng. Số lượng dead code được báo cáo theo
asset và trong terminal reporter, kèm bảng coverage và phân bổ chunk.

### Safety boundary

Không bao giờ đổi tên/rewrite:

- CSS Modules: `*.module.css`, `*.module.scss`, `*.module.sass`, `*.module.less`;
- Vue scoped: `data-v-*`;
- Svelte scoped: `svelte-*`;
- Astro scoped island: `data-astro-cid-*`;
- CSS-in-JS runtime của Ant Design, Emotion/MUI, Chakra UI.

Page loader, common import và asset đầu ra giữ nguyên class hash cũng như
selector runtime của framework.

---

## Kiến trúc

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

### Hai nhóm adapter

**Build-time bundler plugin**

- `@zealamic/css-doctor-vite` — Vite, Vue, Svelte, React, Astro, TanStack Start,
  TanStack Router và mọi framework dựa trên Vite.
- `@zealamic/css-doctor-next` — Next.js App Router và Pages Router.
- `@zealamic/css-doctor-rsbuild` — Rsbuild và Rspack.
- `@zealamic/css-doctor-nuxt` — module chính thức cho Nuxt 4.

Các adapter này dùng được toàn bộ build graph:

- `pageCoverage`
- `sizeBudget`
- `isolateVariables`
- `minify`
- dead-code elimination
- terminal diagnostics

**Runtime middleware**

- `@zealamic/css-doctor-remix` — middleware asset server cho Remix 3.

Remix phục vụ asset qua `createAssetServer`, không có đồ thị page/CSS lúc build.
Wrapper hỗ trợ `sizeBudget`, `isolateVariables`, `minify` và LRU response cache,
nhưng **không hỗ trợ `pageCoverage`**.

---

## Ma trận hỗ trợ

| Adapter | Hệ sinh thái | Page coverage | Size budget | Variables isolation | Dead code | Thời điểm chạy |
| --- | --- | --- | --- | --- | --- | --- |
| `@zealamic/css-doctor-vite` | Vite, React, Vue, Svelte, TanStack Start/Router | ✅ | ✅ | ✅ | ✅ | Build-time |
| `@zealamic/css-doctor-vite` | Astro qua Vite integration | ✅ | ✅ | ✅ | ✅ | Build-time |
| `@zealamic/css-doctor-nuxt` | Nuxt 4 | ✅ | ✅ | ✅ | ✅ | Build-time client |
| `@zealamic/css-doctor-next` | Next.js App/Pages Router | ✅ | ✅ | ✅ | ✅ | Build-time client |
| `@zealamic/css-doctor-rsbuild` | Rsbuild / Rspack | ✅ | ✅ | ✅ | ✅ | Build-time |
| `@zealamic/css-doctor-remix` | Remix 3 asset server | ❌ | ✅ | ✅ | ❌ | Runtime middleware |

### Ghi chú Remix 3

Remix 3 không dùng static bundler cho CSS ứng dụng. Asset được phục vụ bởi
`createAssetServer` từ `remix/assets`. `withCssDoctorAssets` bọc server này, tối
ưu response `text/css` thành công và cache theo URL, ETag và content hash.

Middleware cố ý **không chạy page coverage** vì không có route-to-CSS graph tại
thời điểm request. Nó dùng `sizeBudget`, `isolateVariables`, `minify` và LRU
cache. Hãy nạp stylesheet theo từng route thay vì hardcode mọi module vào
document head.

---

## Cài đặt nhanh

### Cài đặt

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

Dùng package adapter tương ứng với runtime:

| Adapter | Cài đặt |
| --- | --- |
| Vite / Astro / TanStack | `pnpm add -D @zealamic/css-doctor-vite` |
| Next.js | `pnpm add -D @zealamic/css-doctor-next` |
| Rsbuild / Rspack | `pnpm add -D @zealamic/css-doctor-rsbuild` |
| Nuxt 4 | `pnpm add -D @zealamic/css-doctor-nuxt` |
| Remix 3 | `pnpm add @zealamic/css-doctor-remix` |

Native binding được cài kèm. Không cần Rust toolchain trên nền tảng có prebuilt
binary.

### Yêu cầu

| Runtime | Hỗ trợ |
| --- | --- |
| Node.js | 20 trở lên |
| Bun | Stable hiện tại |
| Deno | v2 |
| CSS | CSS tương thích LightningCSS, Tailwind v4, Sass/SCSS qua host pipeline |

---

## Cấu hình theo framework

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

Dùng cùng plugin `cssDoctor` với `@vitejs/plugin-vue`,
`@sveltejs/vite-plugin-svelte` hoặc `@tanstack/react-start`. Lazy route chunk
giúp page coverage có ý nghĩa:

```tsx
const PageDashboard = lazy(() => import("./pages/page-dashboard"));
const PageSettings = lazy(() => import("./pages/page-settings"));
```

### Astro

Astro chạy trên Vite. Đăng ký plugin trong `astro.config.mjs`:

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

Vite build của Astro không expose HTML cuối trong `generateBundle`; hãy inject
link common/page trong `astro:build:done` hoặc dùng integration của example
Astro đã có.

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

Wrapper giữ nguyên `webpack` callback cũ và chỉ áp dụng cho production client
compilation. CSS Modules được bỏ qua tự động. Common chunk được expose qua
`@import` để HTML/manifest của Next tiếp tục hoạt động.

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

Module Nuxt chỉ chạy ở production client build, bỏ qua Vue scoped styles và bọc
common chunk bằng `@import` có thứ tự để HTML do Nitro render vẫn tải được biến
và common CSS.

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

Nạp style theo từng action thay vì thêm mọi module vào document head:

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

## Tham chiếu cấu hình

| Tùy chọn | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `pageCoverage.enabled` | `boolean` | `true` | Bật phân loại common/page/dead theo route. |
| `pageCoverage.minPageRatio` | `number` | `0.5` | Tỷ lệ page tối thiểu (`0.0`–`1.0`) để vào common. |
| `pageCoverage.forceCommon` | `string[]` | `[]` | Selector/class luôn được giữ trong common chunk. |
| `sizeBudget.enabled` | `boolean` | `true` | Bật chia nhỏ theo dung lượng byte. |
| `sizeBudget.maxChunkSize` | `number` | `60 * 1024` | Số byte tối đa mỗi chunk. Module Nuxt mặc định `30 * 1024`. |
| `sizeBudget.isolateVariables` | `boolean` | `true` | Tách biến `:root` và `@theme` trước khi chia. |
| `minify` | `boolean` | giá trị production/build | Minify CSS bằng LightningCSS. |
| `report` | `boolean` | `true` | In bảng coverage và chunk ra terminal. |
| `exclude` | `(string \| RegExp)[]` | Safety rule cho CSS Modules | Bỏ qua asset khớp mẫu; mức hỗ trợ tùy adapter, safety skip luôn được áp dụng. |
| `include` | `(string \| RegExp)[]` | toàn bộ CSS asset | Giới hạn asset được xử lý (Vite). |
| `pageUsage` | `Record<string, string[]>` | `{}` | Khai báo class usage thủ công cho nội dung ngoài static graph. |
| `onDiagnostics` | `(result) => void \| Promise<void>` | — | Nhận toàn bộ diagnostics sau build. |

### Tùy chọn runtime Remix

| Tùy chọn | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `sizeBudget.enabled` | `boolean` | `true` | Bật chia nhỏ CSS được phục vụ. |
| `sizeBudget.maxChunkSize` | `number` | `60 * 1024` | Kích thước chunk tối đa. |
| `sizeBudget.isolateVariables` | `boolean` | `true` | Tách biến trước khi chia. |
| `minify` | `boolean` | `NODE_ENV === "production"` | Minify CSS đã tối ưu. |
| `cache.enabled` | `boolean` | `true` | Bật LRU cache response đã tối ưu. |
| `cache.maxEntries` | `number` | `100` | Số response tối đa trong cache. |
| `exclude` | `(string \| RegExp)[]` | `[]` | Mẫu URL bổ sung cần bỏ qua. |

---

## Cơ chế phân phối CSS

| Adapter | Common CSS | Page CSS | Hành vi HTML/manifest |
| --- | --- | --- | --- |
| Vite | Inject link hoặc emit common chunk | Loader gắn vào page JS | HTML giữ link bình thường |
| Astro | Inject trong `astro:build:done` | Integration inject link theo route | Trang Astro nhận link tường minh |
| Nuxt 4 | Entry CSS import common chunk | Loader theo page chunk | HTML Nitro link entry |
| Next.js | `@import` wrapper trong asset gốc | Loader trong page JS | Manifest Next giữ nguyên |
| Rsbuild | Emit/cập nhật asset | Plugin emit chunk | Rsbuild HTML/manifest quản lý link |
| Remix 3 | Nối trong một response | Link theo từng document route | Middleware trả CSS đã tối ưu |

Page-specific CSS được giới hạn theo route. Không hardcode toàn bộ module vào
document toàn cục.

---

## Native binary

`@zealamic/css-doctor-binding` phát hành NAPI binary dựng sẵn cho các nền tảng
hỗ trợ. Không cần Rust toolchain khi có binary tương ứng.

| Nền tảng | Kiến trúc | Target |
| --- | --- | --- |
| macOS | Apple Silicon | `darwin-arm64` |
| macOS | Intel | `darwin-x64` |
| Linux | x64 glibc | `linux-x64-gnu` |
| Linux | x64 musl | `linux-x64-musl` |
| Windows | x64 MSVC | `win32-x64-msvc` |

Nền tảng khác cần build binding từ source với Rust toolchain và
`@napi-rs/cli`.

---

## Lưu ý quan trọng và best practice

### Tailwind CSS v4 và Sass

Tuyệt đối không đặt directive Tailwind trong file `.scss`. Sass có thể nuốt
hoặc biên dịch sai `@import "tailwindcss"` và `@theme` trước khi
`@tailwindcss/vite` chạy.

Tách đúng:

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

Import CSS thuần trước, SCSS sau:

```ts
import "./styles/app.css";
import "./styles/styles-custom.scss";
```

### CSS Modules và scoped styles

Engine bảo vệ CSS Modules và scoped CSS của framework mặc định. Không thêm class
module vào `forceCommon`. Không rewrite Vue `data-v-*`, Svelte `svelte-*`,
Astro `data-astro-cid-*` hoặc style tag runtime Emotion/Antd.

### Thư viện UI bên thứ ba

Ant Design, MUI và Chakra inject phần lớn style runtime qua CSS-in-JS. CSS của
chúng không nằm trong static CSS asset của Vite. CSS Doctor có thể tách JS chunk
qua lazy route nhưng không thể tách `<style>` inject runtime. Dùng fixture CSS
tĩnh khi test `sizeBudget` với các thư viện này.

### Remix 3 document shell

Tránh hardcode link cho mọi CSS Module trong `document.tsx`. Chỉ truyền
stylesheet cần thiết cho route hiện tại qua prop controller. Điều này tránh tải
CSS dashboard/settings ở route home.

### NuxtLink prefetch

Nuxt prefetch page được link mặc định. Page CSS loader có thể chạy khi prefetch
và tải CSS của route khác. Khi test route isolation, dùng `no-prefetch` hoặc tắt
prefetch.

### Dynamic class

Static scan không resolve template string như
`` className={`text-${color}`} `` hoặc lookup CSS Module. Dùng `pageUsage` hoặc
`forceCommonSelectors` khi cần giữ các class này.

### Error boundary

Build adapter và Remix runtime middleware không được crash host. Khi parse,
split, callback hoặc reporter lỗi: log cảnh báo và trả CSS gốc hoặc HTTP
response gốc.

---

## Kiểm chứng

Repository dùng Turborepo cho Node và Cargo cho Rust:

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

Build native binding trước TypeScript integration test:

```bash
pnpm --filter @zealamic/css-doctor-binding build
```

Trong workspace này, native build có thể cần:

```bash
PATH="$HOME/.cargo/bin:$PATH" \
CARGO_HOME=/tmp/css-doctor-cargo-home \
CARGO_TARGET_DIR=/tmp/css-doctor-target \
pnpm build
```

Example được loại khỏi dependency monitoring. Kiểm tra adapter bằng example thật:

```bash
pnpm --filter astro-tailwind-sass build
pnpm --filter nuxt-tailwind-sass build
pnpm --filter remix-tailwind-sass build
pnpm --filter vite-react-3rd-ui build
```

---

## Tài liệu từng package

Mỗi README package có link chuyển sang bản tiếng Việt và tiếng Trung.

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

## Giấy phép

MIT. Xem [LICENSE](./LICENSE).
