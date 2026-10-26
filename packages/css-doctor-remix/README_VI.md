<div align="center">

# @zealamic/css-doctor-remix

**Middleware asset server Remix 3 tối ưu CSS runtime.**

Phiên bản 1.0.0-beta.1

[English](./README.md) | [Tiếng Việt](./README_VI.md) | [简体中文](./README_CN.md)

</div>

---

## Cài đặt

```bash
pnpm add @zealamic/css-doctor-remix
```

## Sử dụng

```ts
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
  cache: { enabled: true, maxEntries: 100 },
  exclude: [/\.module\.(css|scss)$/],
});
```

## Tùy chọn

| Tùy chọn | Mặc định | Mô tả |
| --- | --- | --- |
| `sizeBudget.enabled` | `true` | Bật chia nhỏ theo byte budget. |
| `sizeBudget.maxChunkSize` | `60 * 1024` | Số byte tối đa mỗi chunk. |
| `sizeBudget.isolateVariables` | `true` | Tách biến `:root` và `@theme` trước. |
| `minify` | production | Minify CSS bằng LightningCSS. |

## An toàn và giới hạn

- Không có pageCoverage: Remix 3 không có route-to-CSS graph lúc build.
- Tối ưu response text/css thành công và fallback response gốc khi lỗi.
- Dùng LRU cache theo URL, ETag gốc và content hash.
- Nạp stylesheet module theo action controller, không hardcode toàn bộ vào document head.

## Tài liệu đầy đủ

README dự án: [English](../../README.md) | [Tiếng Việt](../../README_VI.md) | [简体中文](../../README_CN.md)
