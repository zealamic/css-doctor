---
name: css-doctor-integrations
description: Implements and debugs css-doctor consumers: the CLI, Vite/Rollup plugin, and Next.js wrapper/Webpack plugin. Use for page scanning, splitCssByPages integration, report/exit behavior, plugin lifecycle, emitted page CSS, and integration tests.
---

# css-doctor integration workflow

## When this skill applies

Use for changes in:

- `packages/cli/`
- `packages/css-doctor-vite/`
- `packages/css-doctor-next/`
- shared behavior around `splitCssByPages`, page scanning, page chunks,
  diagnostics, reporters, and plugin lifecycle

Read `AGENTS.md` first. Read the relevant package source and tests before
editing. All three integrations consume the native binding; build it first.

## File naming

All new files/directories default to kebab-case. React component filenames are
kebab-case too (`app.tsx`, `navbar.tsx`, `home.tsx`); component identifiers
remain PascalCase. Framework/tool-mandated files (`vite.config.*`,
`next.config.*`, `tailwind.config.*`, `postcss.config.*`, `cssd.config.*`,
`tsconfig.json`, `package.json`, `page.tsx`, `layout.tsx`) are exempt.

This is an FE-scoped TypeScript codebase: use `type` object definitions
everywhere, never `interface`. Biome's `useConsistentTypeDefinitions` rule
enforces this.

The demo uses Tailwind v4 through `@tailwindcss/vite` and
`@import 'tailwindcss';`; there is no `tailwind.config.js` or PostCSS config.

## Shared pipeline

1. Determine pages/routes and their class usage.
2. Associate emitted CSS assets with pages.
3. Read each CSS asset.
4. Call `splitCssByPages({ cssContent, pageUsage, config })`.
5. Replace the original CSS asset with `commonCss`.
6. Aggregate page-specific CSS by page.
7. Emit page CSS files.
8. Report diagnostics and call `onDiagnostics`.
9. Never let parse/split/callback/reporter errors crash the host build.

Class usage is case-insensitive. A selector counts for a page if at least one
of its classes appears in that page's usage. Global selectors with no classes
go to common. Page chunks are **emitted but not linked into HTML/manifests
yet** — state this limitation explicitly in docs and final answers.

## CLI (`packages/cli`)

- ESM, `tsup`, Commander.
- Entry: `src/index.ts`; built to `dist/index.js` with shebang.
- No hand-written JS source; tests are TS run with `tsx --test`.
- `css-doctor check` supports paths/globs, `-j/--json`, `--threshold`.
- Exit code: `1` for fatal setup/read/analyze failures; warnings/hints keep `0`
  unless future flags change this contract.
- Use lazy binding loading so `--help`/`--version` work before the native build.
- Verify:

  ```bash
  pnpm --filter @zealamic/css-doctor-cli test
  ./packages/cli/dist/index.js check "packages/cli/test/fixtures/*.css" --json
  ```

## Vite plugin (`packages/css-doctor-vite`)

- Hooks: `generateBundle`, `apply: 'build'`, `enforce: 'post'`.
- Page discovery: entry chunks (`isEntry`), entry HTML source, module/chunk
  code, and direct `pageUsage`.
  - Entries without direct dynamic imports are single pages.
  - An entry with direct `import()` routes is a SPA shell: shell classes/CSS
    are shared by every route, and each direct dynamic chunk becomes a page.
  - Route scans skip the entry/shell chunk so a route cannot inherit another
    route's classes through the shared React/runtime chunk.
  - Nested dynamic imports are scanned into their owning route, not promoted
    to separate pages.
- Association: `viteMetadata.importedCss`; orphan CSS falls back to all pages.
- Per CSS asset: analyze → split → `asset.source = commonCss`; aggregate page
  CSS; `this.emitFile({ type: 'asset', fileName: 'static/css/page-*.css' })`.
- Reporter prints the usage matrix and dead code count.
- Errors per asset and per callback are contained with `this.warn`.
- Verify:

  ```bash
  pnpm --filter @zealamic/css-doctor-vite test
  ```

## Next.js integration (`packages/css-doctor-next`)

- `withCssDoctor(nextConfig, options)` preserves the original webpack callback,
  including async callbacks.
- Adds `CssDoctorWebpackPlugin` only when `!context.dev && !context.isServer`.
- Webpack hooks:
  - `compiler.hooks.thisCompilation`
  - `compilation.hooks.processAssets` at `PROCESS_ASSETS_STAGE_OPTIMIZE`
  - replace with `compilation.updateAsset(..., new RawSource(commonCss))`
  - emit with `compilation.emitAsset('static/css/page-*.css', ...)`
- Page discovery supports App Router (`app/**/page`, layouts) and Pages Router
  (`pages/**`, `_app`) plus source scanning of route/layout files and relative
  imports / `@/` aliases. App Router page chunks are stubs in the client build,
  so source scanning is required; do not remove it.
- `cssd.config.ts` is loaded synchronously with `jiti` only when no inline
  options are provided; explicit `configFile` is supported. Config errors warn
  and fall back, never crash Next config loading.
- Verify:

  ```bash
  pnpm --filter @zealamic/css-doctor-next test
  pnpm --filter @zealamic/css-doctor-next test:next
  ```

## Known limitations

- Page-specific files are not injected into Vite HTML or Next manifests/HTML.
- CSS Modules/dynamic class names require `pageUsage` or
  `forceCommonSelectors`.
- Next alias resolution supports relative imports and `@/`; other aliases need
  explicit usage.
- Multi-class selectors use conservative any-class matching.
- `@keyframes` are common; per-page animation tracking is not implemented.

## Integration change checklist

- Build native binding first.
- Keep error boundaries intact.
- Update public option/diagnostic types.
- Add or update a test that exercises the real host integration where feasible.
- Rebuild package (`tsup`) and inspect emitted `.d.ts`.
- Run package typecheck, build, tests.
- Document page-chunk linking limitation if behavior/story changes.
