# Edge-case cheatsheet

Real failures and the safe resolution patterns for css-doctor integrations.

## 1. Tailwind CSS v4 inside Sass

### Symptom

- Layout collapses completely.
- Navbar items stack vertically.
- Tailwind utility classes are missing.
- Font falls back to Times New Roman.

### Cause

`@import "tailwindcss";` and `@theme` were placed in a `.scss` file. Sass
processes the file before `@tailwindcss/vite`, consuming or miscompiling the
Tailwind directives.

### Rule

Keep Tailwind in a pure `.css` file:

```css
/* app.css or styles-tailwind.css */
@import "tailwindcss";

@theme {
  --color-brand: #3b82f6;
  --font-sans: "Inter", system-ui, sans-serif;
}
```

Keep Sass in a separate file:

```scss
/* styles-custom.scss */
@mixin glass {
  background: rgba(17, 24, 39, 0.7);
  border: 1px solid var(--zl-panel-border);
  border-radius: 0.75rem;
}

.panel {
  @include glass;
  padding: 1.5rem;
}
```

Import order: Tailwind CSS first, then Sass.

```astro
import "../styles/app.css";
import "../styles/styles-custom.scss";
```

Never put `@import "tailwindcss"` or `@theme` in `.scss`.

## 2. Scoped CSS and CSS Modules safety boundary

Skip optimization or renaming for:

- `*.module.css`, `*.module.scss`, `*.module.sass`, `*.module.less`
- Vue `[data-v-*]` / `data-v-*`
- Svelte `svelte-*`
- Astro `data-astro-cid-*`
- Vite CSS Module local IDs such as `_card_1udun_1`

### Symptoms of a violation

- Scoped component styles disappear.
- CSS module classes no longer match `styles.wrapper`.
- Vue/Svelte/Astro attributes remain in HTML but selectors changed.
- Hydration works but the page is unstyled.

### Vite options

```ts
cssDoctor({
  skipVueScopedStyles: true,
  exclude: [/\.module\.(css|scss|sass|less)$/],
});
```

Nuxt sets both automatically. Next and Rsbuild must keep their existing CMS
skip logic. Remix's middleware defaults to skipping `*.module.css`; use its
`exclude` option for additional module patterns.

## 3. Third-party UI libraries (Antd, MUI, Chakra)

Ant Design v6, MUI v6, and Chakra v3 mostly inject styles at runtime via
CSS-in-JS/Emotion. Their CSS is not present in the Vite CSS asset bundle.

Consequences:

- CSS Doctor cannot split their runtime-injected style tags.
- Their JavaScript chunks are still split by `React.lazy()`.
- To test `sizeBudget`, add a static CSS fixture with enough shared rules to
  exceed the budget, or use a library that emits static CSS.
- Never rewrite Emotion `<style data-emotion>` nodes or Antd CSS-in-JS tags.

Recommended lazy-route pattern:

```tsx
const PageAntd = lazy(() => import("./pages/page-antd"));
const PageMui = lazy(() => import("./pages/page-mui"));
const PageChakra = lazy(() => import("./pages/page-chakra"));

<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route element={<PageAntd />} path="/antd" />
    <Route element={<PageMui />} path="/mui" />
    <Route element={<PageChakra />} path="/chakra" />
  </Routes>
</Suspense>
```

For Chakra v3, mount `ChakraProvider` with `defaultSystem` at the root, or the
route throws a runtime context error.

## 4. Remix 3 hardcoded stylesheets

Do not put all module stylesheets in the shared `document.tsx` head. That loads
dashboard/settings/module CSS on every route.

Use per-action stylesheets:

```tsx
<Document
  title="Dashboard"
  stylesheets={["/assets/app/styles/dashboard.module.scss"]}
>
  <NavBar />
  <DashboardPage />
</Document>
```

Home receives only shared styles:

```tsx
<Document title="Home | Remix 3">
  <NavBar />
  <HomePage />
</Document>
```

Keep global styles (`app.css`, `styles-global.css`, `styles-custom.scss`) in the
document; keep page-specific modules in controller actions.

## 5. Remix AssetServer returns `Response | null`

Remix's API allows an asset server to decline a request:

```ts
fetch(request: Request): Promise<Response | null>
```

Adapters must handle `null`, not assume `Response`. On null, pass through null.
On non-200, non-`text/css`, module, or error, return the original response.

## 6. Remix common chunks and single-response assets

Remix returns one response per asset URL. A size split produces variables and
common parts internally; the middleware concatenates them in deterministic
order into one response. Do not invent side-channel asset URLs.

If the response body is changed:

- Update `Content-Length`.
- Recompute `ETag`.
- Remove invalid `Content-Encoding` / `Transfer-Encoding`.
- Cache by URL + source ETag + content hash.

## 7. Nuxt/Nitro common CSS links

Nuxt HTML is produced by Nitro, not by Vite's HTML bundle. Emitting common
chunks without linking them leaves `entry.css` empty and the page unstyled.

Use:

```ts
cssDoctor({ ...options, wrapCommonImports: true })
```

The entry CSS becomes:

```css
@import "./common-vars-xxxx.css";
@import "./common-part-1-xxxx.css";
```

Page CSS remains lazy via page chunk loaders.

## 8. NuxtLink prefetch loads other route CSS

Nuxt prefetches linked pages by default. Their page JS chunks run CSS loaders,
so a home page may load dashboard/settings CSS during prefetch. For route
isolation tests, use `no-prefetch` on links or disable route prefetch.

## 9. Astro page CSS is not in Vite HTML

Astro's Vite server build has no final HTML asset. Emitting `page-*.css` alone
is not enough. The example must inject common/page stylesheet links in
`astro:build:done` (or an equivalent integration).

## 10. Vite duplicate page-loader declaration

Prepend loaders inside an IIFE:

```js
(() => {
  const styles = ["./page-home-abc.css"];
  if (typeof document !== "undefined") {
    // append link tags once
  }
})();
```

Without the IIFE, multiple chunks can declare the same top-level identifier.

## 11. Size-budget edge cases

- Splitting only cuts between top-level AST rules.
- A single oversized rule is emitted alone and marked `oversized`.
- `@media`, `@supports`, `@keyframes`, and other blocks stay intact.
- Variables are isolated before physical splitting.
- Use deterministic fixture selectors for repeatable split assertions.
- Do not lower production budgets just to force a fixture to split; add a
  deliberate shared fixture when testing.

## 12. Page coverage with dynamic class names

Static scanning cannot resolve:

```tsx
className={`text-${color}`}
```

or CSS Module lookups from code. Use `pageUsage` or `forceCommonSelectors` for
these cases. A selector is used if at least one class in it appears in the
page's usage set; this is intentionally conservative.

## 13. Tailwind + PostCSS vs Vite plugin

- Vite/Astro/Nuxt: use `@tailwindcss/vite`.
- Next.js: use `@tailwindcss/postcss` with `postcss.config.mjs`.
- Never apply both to the same stylesheet.
- Tailwind v4 has no `tailwind.config.js` requirement; `@theme` is the token
  source.

## 14. Debugging checklist

1. Confirm the adapter ran in the production build, not dev/SSR.
2. Confirm CSS Modules/scoped files were skipped.
3. Check emitted CSS assets and HTML links/loaders.
4. Inspect computed styles in a real browser, not only build logs.
5. Verify `@theme` / `:root` variables exist in the served CSS.
6. Verify dead selectors are absent from output.
7. Verify page-specific CSS is requested only on its route.
8. Re-run package tests and the example production build.
