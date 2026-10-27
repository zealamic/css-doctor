<div align="center">

# css-doctor

**Bộ công cụ chẩn đoán, phân tách và tối ưu CSS native cho các ứng dụng web hiện đại.**

[![npm version](https://img.shields.io/npm/v/@zealamic/css-doctor-cli.svg)](https://www.npmjs.com/package/@zealamic/css-doctor-cli)
[![CI](https://github.com/zealamic/css-doctor/actions/workflows/release.yml/badge.svg)](https://github.com/zealamic/css-doctor/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Rust](https://img.shields.io/badge/rust-stable-b7410e?logo=rust&logoColor=white)](https://www.rust-lang.org)

[English](./README.md) | [Tiếng Việt](./README_VI.md) | [简体中文](./README_CN.md)

</div>

---

## Tổng quan

`css-doctor` là bộ công cụ phân tích và tối ưu CSS được xây dựng trên lõi Rust
native sử dụng **LightningCSS AST**, kết nối với Node.js qua **NAPI-RS**.

Công cụ không chỉ minify. Nó giúp phát hiện selector lỗi, tìm CSS chết, hiểu
page coverage, tách biến CSS và chia nhỏ stylesheet quá lớn mà không làm hỏng
CSS Modules hay scoped styles của framework.

Dự án cung cấp CLI zero-config, native binding và adapter chính thức cho Vite,
Next.js, Nuxt, Remix và Rsbuild.

---

## Tính năng nổi bật

### Hiệu năng Rust native

Parse, trích xuất selector, chẩn đoán và phân tách CSS đều chạy trong Rust core.
Bề mặt Node.js chỉ là cầu nối NAPI-RS mỏng, nên phân tích vẫn nhanh với
stylesheet lớn.

### CLI zero-config

Chạy `css-doctor` ngay bằng `npx`, hoặc cài làm dev dependency. CLI đã bundle
các JavaScript dependency; chỉ native binding được giữ external và require
động lúc runtime.

### Chẩn đoán toàn diện

CLI báo cáo:

- cảnh báo cú pháp;
- rule rỗng hoặc dead rule;
- selector trùng lặp;
- stylesheet quá lớn và ngưỡng selector;
- số selector, rule, declaration và thời gian phân tích;
- JSON output cho CI.

### Native binary đa nền tảng

`@zealamic/css-doctor-binding` tự phân giải binary NAPI dựng sẵn cho:

| Nền tảng | Kiến trúc | Target |
| --- | --- | --- |
| macOS | Apple Silicon | `darwin-arm64` |
| macOS | Intel | `darwin-x64` |
| Linux | x64 glibc | `linux-x64-gnu` |
| Linux | x64 musl | `linux-x64-musl` |
| Windows | x64 MSVC | `win32-x64-msvc` |

Không cần Rust toolchain trên nền tảng có binary hỗ trợ.

### Tối ưu CSS theo framework

Các integration hỗ trợ page-coverage splitting, size budget, variables
isolation, dead-code elimination và xử lý an toàn CSS Modules, Vue scoped,
Svelte scoped, Astro scoped.

---

## Bắt đầu nhanh

### Chạy CLI không cần cài đặt

```bash
npx @zealamic/css-doctor-cli check "src/**/*.css"
```

### Cài CLI

```bash
pnpm add -D @zealamic/css-doctor-cli

# hoặc
npm install -D @zealamic/css-doctor-cli
```

### Các lệnh thường dùng

```bash
# Trợ giúp và phiên bản
css-doctor --help
css-doctor --version

# Kiểm tra một file
css-doctor check src/styles/app.css

# Kiểm tra glob có quote
css-doctor check "src/**/*.css"

# JSON output cho CI
css-doctor check "src/**/*.css" --json

# Cảnh báo khi file có hơn 500 selector
css-doctor check "src/**/*.css" --threshold 500
```

Ví dụ output:

```text
css-doctor v1.0.0-beta-2 · check
patterns src/**/*.css
────────────────────────────────────────────────────────────
 SUCCESS  src/styles/app.css · 12.4 KB
  selectors 184 · rules 132 · declarations 421
  analysis 3.2 ms · read 0.8 ms · total 4.0 ms
```

---

## Tích hợp framework

| Framework / tool | Package | Cài đặt |
| --- | --- | --- |
| Vite, React, Vue, Svelte, TanStack | [`@zealamic/css-doctor-vite`](https://www.npmjs.com/package/@zealamic/css-doctor-vite) | `pnpm add -D @zealamic/css-doctor-vite` |
| Next.js App/Pages Router | [`@zealamic/css-doctor-next`](https://www.npmjs.com/package/@zealamic/css-doctor-next) | `pnpm add -D @zealamic/css-doctor-next` |
| Nuxt 4 | [`@zealamic/css-doctor-nuxt`](https://www.npmjs.com/package/@zealamic/css-doctor-nuxt) | `pnpm add -D @zealamic/css-doctor-nuxt` |
| Remix 3 | [`@zealamic/css-doctor-remix`](https://www.npmjs.com/package/@zealamic/css-doctor-remix) | `pnpm add @zealamic/css-doctor-remix` |
| Rsbuild / Rspack | [`@zealamic/css-doctor-rsbuild`](https://www.npmjs.com/package/@zealamic/css-doctor-rsbuild) | `pnpm add -D @zealamic/css-doctor-rsbuild` |
| CLI | [`@zealamic/css-doctor-cli`](https://www.npmjs.com/package/@zealamic/css-doctor-cli) | `pnpm add -D @zealamic/css-doctor-cli` |
| Native binding | [`@zealamic/css-doctor-binding`](https://www.npmjs.com/package/@zealamic/css-doctor-binding) | Cài tự động qua dependency |

Mỗi thư mục package có README tiếng Anh, tiếng Việt và tiếng Trung. Bản dịch
root vẫn có tại [English](./README.md) và [简体中文](./README_CN.md).

### Vite

```ts
// vite.config.ts
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
      minify: true,
      report: true,
    }),
  ],
});
```

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

### Khả năng của adapter

| Adapter | Page coverage | Size budget | Variables isolation | Dead code |
| --- | --- | --- | --- | --- |
| Vite / Astro / TanStack | Có | Có | Có | Có |
| Next.js | Có | Có | Có | Có |
| Nuxt 4 | Có | Có | Có | Có |
| Rsbuild / Rspack | Có | Có | Có | Có |
| Remix 3 runtime | Không | Có | Có | Không |

Remix 3 không có page-to-CSS dependency graph lúc build. Middleware dùng
`sizeBudget`, `isolateVariables`, `minify` và response cache thay vì page
coverage runtime.

---

## Tham chiếu cấu hình

| Tùy chọn | Kiểu | Mặc định | Mô tả |
| --- | --- | --- | --- |
| `pageCoverage.enabled` | `boolean` | `true` | Bật phân loại coverage theo route. |
| `pageCoverage.minPageRatio` | `number` | `0.5` | Tỷ lệ page tối thiểu (`0.0`–`1.0`) cho common CSS. |
| `pageCoverage.forceCommon` | `string[]` | `[]` | Selector/class luôn giữ trong common chunk. |
| `sizeBudget.enabled` | `boolean` | `true` | Bật chia nhỏ theo byte budget. |
| `sizeBudget.maxChunkSize` | `number` | `60 * 1024` | Số byte tối đa mỗi chunk. |
| `sizeBudget.isolateVariables` | `boolean` | `true` | Tách biến `:root` và Tailwind `@theme` trước. |
| `minify` | `boolean` | giá trị production/build | Minify CSS bằng LightningCSS. |
| `report` | `boolean` | `true` | In chẩn đoán coverage và split. |
| `exclude` | `(string \| RegExp)[]` | Safety rule CSS Modules | Bỏ qua asset khớp mẫu. |

Xem README của từng adapter để biết đầy đủ danh sách tùy chọn.

---

## Kiến trúc monorepo

```text
css-doctor/
├── crates/
│   └── core/                  # Rust engine và LightningCSS analysis
├── packages/
│   ├── binding/               # NAPI-RS bridge
│   ├── binding/npm/           # 5 platform packages được generate
│   ├── cli/                   # @zealamic/css-doctor-cli
│   ├── css-doctor-vite/       # Vite adapter
│   ├── css-doctor-next/       # Next.js adapter
│   ├── css-doctor-rsbuild/    # Rsbuild/Rspack adapter
│   ├── css-doctor-nuxt/       # Nuxt 4 module
│   └── css-doctor-remix/      # Remix 3 runtime middleware
├── examples/                  # Integration fixtures
└── .github/workflows/         # CI và release automation
```

### Yêu cầu

- Node.js 20 trở lên
- pnpm 9
- Rust stable khi build native từ source

### Phát triển local

```bash
git clone https://github.com/zealamic/css-doctor.git
cd css-doctor

pnpm install

# Build native binding
pnpm --filter @zealamic/css-doctor-binding build

# Chỉ build các package publish
pnpm build

# Build thêm toàn bộ examples
pnpm build:all

# Typecheck / test / format
pnpm typecheck
pnpm test
pnpm check
```

Kiểm tra Rust:

```bash
cargo test --workspace
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo fmt --all -- --check
```

### Release

Push tag như `v1.0.0-beta-2` sẽ kích hoạt release workflow:

1. Build 5 native targets.
2. Build CLI và toàn bộ adapter.
3. Verify binary, dist declaration và CLI standalone bundle.
4. Publish tất cả package theo dependency order với đúng npm dist-tag.

---

## Đóng góp

1. Fork repo và tạo branch kebab-case.
2. Đọc [`AGENTS.md`](./AGENTS.md) và README package liên quan.
3. Thêm test cho thay đổi hành vi.
4. Chạy `pnpm check`, `pnpm test` và build package liên quan.
5. Mở pull request kèm lệnh kiểm tra và known limitations.

Không chỉnh sửa file generated:

```text
packages/binding/index.js
packages/binding/index.d.ts
packages/binding/*.node
packages/*/dist/**
```

Không sửa `examples/**` trừ khi task chỉ định rõ example đó.

---

## Giấy phép

MIT. Xem [LICENSE](./LICENSE).
