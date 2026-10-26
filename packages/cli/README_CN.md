<div align="center">

# @zealamic/css-doctor-cli

**使用原生 css-doctor 引擎的命令行 CSS 诊断工具。**

版本 1.0.0-beta.1

[English](./README.md) | [Tiếng Việt](./README_VI.md) | [简体中文](./README_CN.md)

</div>

---

## 安装

```bash
pnpm add -D @zealamic/css-doctor-cli
```

## 使用

```bash
# 分析文件或带引号的 glob
pnpm exec css-doctor check "src/**/*.css"

# 适用于 CI/CD 的 JSON 输出
pnpm exec css-doctor check "src/**/*.css" --json

# 当文件 selector 超过 500 时警告
pnpm exec css-doctor check "src/**/*.css" --threshold 500
```

## 安全与限制

- 命令名为 css-doctor，通过 package.json 的 bin 字段暴露。
- --json 输出稳定的 CheckReport 结构，包含 files、issues 和 summary。
- 初始化、读取或分析发生致命错误时返回非零退出码；warning 仍会显示在报告中。

## 完整文档

项目 README：[English](../../README.md) | [Tiếng Việt](../../README_VI.md) | [简体中文](../../README_CN.md)
