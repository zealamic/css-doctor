import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import { analyzeCss, splitCssByPages } from "@zealamic/css-doctor-binding";
import type {
  JsCssAnalysisResult,
  JsSelectorStat,
} from "@zealamic/css-doctor-binding";
import type { Compilation, Compiler, Entrypoint, Module } from "webpack";

import { printDiagnostics } from "./reporter";
import type {
  CssAssetDiagnostic,
  CssAssetWarning,
  CssDoctorNextDiagnostics,
  CssDoctorWebpackPluginOptions,
  EmittedPageChunk,
} from "./types";

const PLUGIN_NAME = "CssDoctorWebpackPlugin";
const DEFAULT_MIN_PAGE_RATIO = 0.5;
const LARGE_CSS_ASSET_BYTES = 500 * 1_024;

type PageInfo = {
  name: string;
  classes: Set<string>;
  cssFiles: Set<string>;
};

type PageEntry = {
  entry: Entrypoint;
  name: string;
  sourceName: string;
};

type CollectedPages = {
  pages: PageInfo[];
  pagesByCss: Map<string, Set<string>>;
};

/**
 * Webpack compiler plugin that splits emitted client CSS by page coverage and
 * removes selectors no route uses.
 *
 * All work happens inside `processAssets` at the optimize stage. Failures are
 * logged through the compilation logger and never abort the Next.js build.
 */
export class CssDoctorWebpackPlugin {
  private readonly options: CssDoctorWebpackPluginOptions;
  private readonly minPageRatio: number;
  private readonly configurationError?: string;

  constructor(options: CssDoctorWebpackPluginOptions = {}) {
    this.options = options;

    const ratio = options.minPageRatio ?? DEFAULT_MIN_PAGE_RATIO;

    if (Number.isFinite(ratio) && ratio >= 0 && ratio <= 1) {
      this.minPageRatio = ratio;
    } else {
      this.minPageRatio = DEFAULT_MIN_PAGE_RATIO;
      this.configurationError =
        "minPageRatio must be a number between 0 and 1; using 0.5";
    }
  }

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        {
          name: PLUGIN_NAME,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
        },
        async () => {
          try {
            await this.process(compiler, compilation);
          } catch (error) {
            compilation
              .getLogger(PLUGIN_NAME)
              .warn(
                `[css-doctor] diagnostics failed without interrupting the build: ${describeError(
                  error,
                )}`,
              );
          }
        },
      );
    });
  }

  private async process(
    compiler: Compiler,
    compilation: Compilation,
  ): Promise<void> {
    const startedAt = performance.now();
    const logger = compilation.getLogger(PLUGIN_NAME);
    const pagesResult = await collectPages(compilation, this.options.pageUsage);
    const pageNames = pagesResult.pages.map((page) => page.name);
    const allPages = new Set(pageNames);
    const pageUsage: Record<string, string[]> = {};
    const pageUsageCounts: Record<string, number> = {};

    for (const page of pagesResult.pages) {
      const classes = [...page.classes].sort();
      pageUsage[page.name] = classes;
      pageUsageCounts[page.name] = classes.length;
    }

    const splitApplied = pageNames.length > 0;
    const diagnostics: CssDoctorNextDiagnostics = {
      plugin: "css-doctor-next",
      generatedAt: new Date().toISOString(),
      durationMs: 0,
      minPageRatio: this.minPageRatio,
      pages: pageNames,
      pageUsage: pageUsageCounts,
      splitApplied,
      totalCssAssets: 0,
      analyzedCssAssets: 0,
      failedCssAssets: 0,
      totalSizeBeforeBytes: 0,
      totalSizeAfterBytes: 0,
      totalSelectors: 0,
      totalRules: 0,
      commonCssBytes: 0,
      pageSpecificCssBytes: 0,
      emittedPageChunks: [],
      usageMatrix: [],
      deadCodeCount: 0,
      files: [],
      errors: [],
    };

    if (this.configurationError) {
      diagnostics.errors.push(this.configurationError);
    }

    const matrix = new Map<string, JsSelectorStat>();
    const pageCssParts = new Map<string, string[]>();
    const usedAssetNames = new Set(
      compilation.getAssets().map((asset) => asset.name),
    );
    const RawSource = compiler.webpack.sources.RawSource;

    for (const asset of compilation.getAssets()) {
      if (!asset.name.endsWith(".css")) {
        continue;
      }

      diagnostics.totalCssAssets += 1;

      const associatedPages = [
        ...(pagesResult.pagesByCss.get(asset.name) ?? allPages),
      ].sort();
      const file = analyzeAsset(asset.name, asset.source.source());
      file.associatedPages = associatedPages;

      if (file.error) {
        diagnostics.failedCssAssets += 1;
        diagnostics.errors.push(`${asset.name}: ${file.error}`);
        diagnostics.files.push(file);
        logger.warn(`[css-doctor] ${asset.name}: ${file.error}`);
        continue;
      }

      const originalCss = sourceToString(asset.source.source());

      if (splitApplied && file.analysis) {
        try {
          const split = splitCssByPages({
            cssContent: originalCss,
            pageUsage,
            config: {
              minPageRatio: this.minPageRatio,
              forceCommonSelectors: this.options.forceCommonSelectors ?? [],
            },
          });

          compilation.updateAsset(asset.name, new RawSource(split.commonCss));
          file.sizeAfterBytes = Buffer.byteLength(split.commonCss, "utf8");
          file.split = {
            associatedPages,
            commonSizeBytes: file.sizeAfterBytes,
            pageSpecificSizeBytes: 0,
            deadCodeCount: split.deadCodeCount,
          };

          let pageSpecificSizeBytes = 0;

          for (const page of associatedPages) {
            const pageCss = split.pageChunks[page];

            if (pageCss && pageCss.trim().length > 0) {
              const parts = pageCssParts.get(page) ?? [];
              parts.push(pageCss);
              pageCssParts.set(page, parts);
              pageSpecificSizeBytes += Buffer.byteLength(pageCss, "utf8");
            }
          }

          file.split.pageSpecificSizeBytes = pageSpecificSizeBytes;

          for (const stat of split.stats) {
            const previous = matrix.get(stat.selector);

            if (
              !previous ||
              stat.totalOccurrences > previous.totalOccurrences
            ) {
              matrix.set(stat.selector, stat);
            }
          }

          diagnostics.deadCodeCount += split.deadCodeCount;
        } catch (error) {
          const message = `failed to split CSS: ${describeError(error)}`;
          diagnostics.errors.push(`${asset.name}: ${message}`);
          logger.warn(`[css-doctor] ${asset.name}: ${message}`);
        }
      }

      diagnostics.analyzedCssAssets += 1;
      diagnostics.totalSizeBeforeBytes += file.sizeBeforeBytes;
      diagnostics.totalSizeAfterBytes += file.sizeAfterBytes;
      diagnostics.totalSelectors += file.selectorCount;
      diagnostics.totalRules += file.ruleCount;
      diagnostics.files.push(file);
    }

    diagnostics.commonCssBytes = diagnostics.totalSizeAfterBytes;

    if (splitApplied) {
      for (const [page, parts] of pageCssParts) {
        const css = parts.join("\n");
        const fileName = uniquePageAssetName(page, usedAssetNames);
        const sizeBytes = Buffer.byteLength(css, "utf8");

        try {
          compilation.emitAsset(fileName, new RawSource(css));
        } catch (error) {
          diagnostics.errors.push(
            `failed to emit ${fileName}: ${describeError(error)}`,
          );
          continue;
        }

        usedAssetNames.add(fileName);

        const emitted: EmittedPageChunk = {
          page,
          fileName,
          sizeBytes,
        };

        diagnostics.emittedPageChunks.push(emitted);
        diagnostics.pageSpecificCssBytes += sizeBytes;
      }
    }

    diagnostics.usageMatrix = [...matrix.values()].sort((left, right) =>
      left.selector.localeCompare(right.selector),
    );
    diagnostics.durationMs = roundMs(performance.now() - startedAt);

    if (this.options.onDiagnostics) {
      try {
        await this.options.onDiagnostics(diagnostics);
      } catch (error) {
        const message = `onDiagnostics callback failed: ${describeError(
          error,
        )}`;
        diagnostics.errors.push(message);
        logger.warn(`[css-doctor] ${message}`);
      }
    }

    if (
      this.options.report !== false &&
      (diagnostics.totalCssAssets > 0 || diagnostics.errors.length > 0)
    ) {
      try {
        printDiagnostics(diagnostics);
      } catch (error) {
        logger.warn(`[css-doctor] reporter failed: ${describeError(error)}`);
      }
    }
  }
}

function analyzeAsset(
  fileName: string,
  source: string | Buffer,
): CssAssetDiagnostic {
  try {
    const css = sourceToString(source);
    const sizeBeforeBytes = Buffer.byteLength(css, "utf8");
    const analysis = analyzeCss(css);
    const warnings = collectSyntaxWarnings(analysis);

    if (sizeBeforeBytes >= LARGE_CSS_ASSET_BYTES) {
      warnings.push({
        kind: "large-asset",
        message: `CSS asset is larger than ${formatBytes(
          LARGE_CSS_ASSET_BYTES,
        )}; consider route-level code splitting.`,
      });
    }

    return {
      fileName,
      sizeBeforeBytes,
      sizeAfterBytes: sizeBeforeBytes,
      selectorCount: analysis.stats.selectorCount,
      ruleCount: analysis.stats.ruleCount,
      associatedPages: [],
      warnings,
      analysis,
    };
  } catch (error) {
    return {
      fileName,
      sizeBeforeBytes: 0,
      sizeAfterBytes: 0,
      selectorCount: 0,
      ruleCount: 0,
      associatedPages: [],
      warnings: [],
      error: describeError(error),
    };
  }
}

async function collectPages(
  compilation: Compilation,
  directPageUsage: Record<string, string[]> | undefined,
): Promise<CollectedPages> {
  const entries = [...compilation.entrypoints.values()];
  const pageEntries: PageEntry[] = [];
  const sharedEntries: Entrypoint[] = [];
  const fallbackEntries: PageEntry[] = [];

  for (const entry of entries) {
    const name = entryName(entry);

    if (!name) {
      continue;
    }

    if (isPageEntry(name)) {
      const route = routeNameForEntry(name) ?? name;
      pageEntries.push({ entry, name: route, sourceName: name });
    } else if (isSharedEntry(name)) {
      sharedEntries.push(entry);
    } else if (!isInternalEntry(name)) {
      fallbackEntries.push({
        entry,
        name: routeNameForEntry(name) ?? name,
        sourceName: name,
      });
    }
  }

  const selectedPages = pageEntries.length > 0 ? pageEntries : fallbackEntries;
  const direct = directPageUsage
    ? Object.keys(directPageUsage).length > 0
    : false;
  const pages = new Map<string, PageInfo>();
  const pagesByCss = new Map<string, Set<string>>();

  if (direct && directPageUsage) {
    for (const [rawName, classes] of Object.entries(directPageUsage)) {
      const name = rawName.trim();

      if (!name) {
        continue;
      }

      pages.set(name, {
        name,
        classes: new Set(classes.map((className) => className.toLowerCase())),
        cssFiles: new Set(),
      });
    }
  } else {
    const sourceCache = new Map<string, Promise<string | undefined>>();
    const sharedClasses = new Set<string>();

    const projectRoot = process.cwd();

    for (const entry of sharedEntries) {
      for (const className of await collectEntryClasses(
        compilation,
        entry,
        sourceCache,
      )) {
        sharedClasses.add(className);
      }

      const name = entryName(entry);

      if (name) {
        for (const className of await collectNameSourceClasses(
          name,
          projectRoot,
          sourceCache,
        )) {
          sharedClasses.add(className);
        }
      }
    }

    for (const { entry, name, sourceName } of selectedPages) {
      const page = pages.get(name) ?? {
        name,
        classes: new Set<string>(),
        cssFiles: new Set<string>(),
      };

      for (const className of sharedClasses) {
        page.classes.add(className);
      }

      for (const className of await collectEntryClasses(
        compilation,
        entry,
        sourceCache,
      )) {
        page.classes.add(className);
      }

      for (const className of await collectPageSourceClasses(
        sourceName,
        projectRoot,
        sourceCache,
      )) {
        page.classes.add(className);
      }

      pages.set(name, page);
    }
  }

  const targetPages = [...pages.keys()];

  for (const { entry, name } of selectedPages) {
    const cssFiles = collectEntryCssFiles(entry);

    if (direct) {
      const directPage = pages.get(name);

      if (directPage) {
        for (const cssFile of cssFiles) {
          directPage.cssFiles.add(cssFile);
        }
      }
    } else {
      const page = pages.get(name);

      if (page) {
        for (const cssFile of cssFiles) {
          page.cssFiles.add(cssFile);
        }
      }
    }
  }

  const sharedCssFiles = new Set<string>();

  for (const entry of sharedEntries) {
    for (const cssFile of collectEntryCssFiles(entry)) {
      sharedCssFiles.add(cssFile);
    }
  }

  for (const page of pages.values()) {
    for (const cssFile of page.cssFiles) {
      addCssOwner(pagesByCss, cssFile, page.name);
    }
  }

  for (const cssFile of sharedCssFiles) {
    for (const page of targetPages) {
      addCssOwner(pagesByCss, cssFile, page);
    }
  }

  return {
    pages: [...pages.values()],
    pagesByCss,
  };
}

async function collectPageSourceClasses(
  entryName: string,
  projectRoot: string,
  sourceCache: Map<string, Promise<string | undefined>>,
): Promise<Set<string>> {
  const classes = new Set<string>();
  const visited = new Set<string>();
  const normalized = normalizeSlashes(entryName);
  const candidates: string[] = [];

  if (normalized.startsWith("app/")) {
    const path = normalized.slice(4);

    if (path === "page" || path.endsWith("/page")) {
      const pagePath = path === "page" ? "app/page" : `app/${path}`;
      candidates.push(resolve(projectRoot, pagePath));

      if (path === "_not-found/page") {
        candidates.push(resolve(projectRoot, "app/not-found"));
      }

      const directories = path.split("/").slice(0, -1).filter(Boolean);
      const layoutPaths = ["app"];

      for (let index = 0; index < directories.length; index += 1) {
        layoutPaths.push(`app/${directories.slice(0, index + 1).join("/")}`);
      }

      for (const layoutPath of layoutPaths) {
        candidates.push(resolve(projectRoot, `${layoutPath}/layout`));
      }
    } else {
      candidates.push(resolve(projectRoot, normalized));
    }
  } else if (normalized.startsWith("pages/")) {
    candidates.push(resolve(projectRoot, normalized));
    candidates.push(resolve(projectRoot, "pages/_app"));
  } else {
    candidates.push(resolve(projectRoot, normalized));
  }

  for (const candidate of candidates) {
    const file = findSourceFile(candidate);

    if (file) {
      await scanSourceFile(file, classes, projectRoot, sourceCache, visited);
    }
  }

  return classes;
}

async function collectNameSourceClasses(
  entryName: string,
  projectRoot: string,
  sourceCache: Map<string, Promise<string | undefined>>,
): Promise<Set<string>> {
  const classes = new Set<string>();
  const visited = new Set<string>();
  const candidate = resolve(projectRoot, normalizeSlashes(entryName));
  const file = findSourceFile(candidate);

  if (file) {
    await scanSourceFile(file, classes, projectRoot, sourceCache, visited);
  }

  return classes;
}

async function scanSourceFile(
  filePath: string,
  classes: Set<string>,
  projectRoot: string,
  sourceCache: Map<string, Promise<string | undefined>>,
  visited: Set<string>,
): Promise<void> {
  const absolutePath = resolve(filePath);

  if (visited.has(absolutePath)) {
    return;
  }

  visited.add(absolutePath);

  let pending = sourceCache.get(absolutePath);

  if (!pending) {
    pending = readFile(absolutePath, "utf8").catch(() => undefined);
    sourceCache.set(absolutePath, pending);
  }

  const source = await pending;

  if (!source) {
    return;
  }

  scanClasses(source, classes);

  for (const specifier of extractImportSpecifiers(source)) {
    const resolved = resolveImportSpecifier(
      specifier,
      absolutePath,
      projectRoot,
    );

    if (resolved && !visited.has(resolved)) {
      await scanSourceFile(
        resolved,
        classes,
        projectRoot,
        sourceCache,
        visited,
      );
    }
  }
}

const SOURCE_EXTENSIONS = [
  ".tsx",
  ".ts",
  ".jsx",
  ".js",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".mdx",
];

function findSourceFile(basePath: string): string | null {
  if (isStyleFile(basePath)) {
    return null;
  }

  if (extname(basePath) && existsSync(basePath)) {
    return basePath;
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = `${basePath}${extension}`;

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = resolve(basePath, `index${extension}`);

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];

      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers];
}

function resolveImportSpecifier(
  specifier: string,
  fromFile: string,
  projectRoot: string,
): string | null {
  let basePath: string;

  if (specifier.startsWith("@/")) {
    basePath = resolve(projectRoot, specifier.slice(2));
  } else if (specifier.startsWith("./") || specifier.startsWith("../")) {
    basePath = resolve(dirname(fromFile), specifier);
  } else {
    return null;
  }

  if (isStyleFile(basePath)) {
    return null;
  }

  return findSourceFile(basePath);
}

async function collectEntryClasses(
  compilation: Compilation,
  entry: Entrypoint,
  sourceCache: Map<string, Promise<string | undefined>>,
): Promise<Set<string>> {
  const classes = new Set<string>();
  const visitedModules = new Set<Module>();

  for (const chunk of entry.chunks) {
    for (const module of compilation.chunkGraph.getChunkModulesIterable(
      chunk,
    )) {
      await scanModule(module, classes, sourceCache, visitedModules);
    }
  }

  return classes;
}

async function scanModule(
  module: Module,
  classes: Set<string>,
  sourceCache: Map<string, Promise<string | undefined>>,
  visited: Set<Module>,
): Promise<void> {
  if (visited.has(module)) {
    return;
  }

  visited.add(module);

  const nested = (module as Module & { modules?: Iterable<Module> }).modules;

  if (nested) {
    for (const child of nested) {
      await scanModule(child, classes, sourceCache, visited);
    }
  }

  const resource = (module as Module & { resource?: unknown }).resource;

  if (typeof resource !== "string" || isStyleFile(resource)) {
    return;
  }

  const source = readModuleSource(module);

  if (source) {
    scanClasses(source, classes);
    return;
  }

  if (!isScannableSource(resource)) {
    return;
  }

  const filePath = resource.split("?")[0] ?? resource;

  if (!filePath) {
    return;
  }

  let pending = sourceCache.get(filePath);

  if (!pending) {
    pending = readFile(filePath, "utf8").catch(() => undefined);
    sourceCache.set(filePath, pending);
  }

  const fresh = await pending;

  if (fresh) {
    scanClasses(fresh, classes);
  }
}

function readModuleSource(module: Module): string | undefined {
  try {
    const source = module.originalSource();

    if (!source) {
      return undefined;
    }

    return sourceToString(source.source());
  } catch {
    return undefined;
  }
}

function collectEntryCssFiles(entry: Entrypoint): Set<string> {
  const cssFiles = new Set<string>();

  for (const file of entry.getFiles()) {
    if (file.endsWith(".css")) {
      cssFiles.add(file);
    }
  }

  for (const chunk of entry.chunks) {
    for (const file of chunk.files) {
      if (file.endsWith(".css")) {
        cssFiles.add(file);
      }
    }

    for (const file of chunk.auxiliaryFiles) {
      if (file.endsWith(".css")) {
        cssFiles.add(file);
      }
    }
  }

  return cssFiles;
}

function entryName(entry: Entrypoint): string | undefined {
  if (entry.name) {
    return entry.name;
  }

  const chunk = entry.getEntrypointChunk();
  return chunk.name ?? undefined;
}

function isPageEntry(name: string): boolean {
  const normalized = normalizeSlashes(name);

  if (normalized.startsWith("app/")) {
    const path = normalized.slice(4);
    return path === "page" || path.endsWith("/page");
  }

  if (normalized.startsWith("pages/")) {
    const path = normalized.slice(6);
    return (
      path.length > 0 &&
      !path.split("/").some((segment) => segment.startsWith("_"))
    );
  }

  return false;
}

function isSharedEntry(name: string): boolean {
  const normalized = normalizeSlashes(name);

  return (
    (normalized.startsWith("app/") &&
      (normalized === "app/layout" || normalized.endsWith("/layout"))) ||
    normalized === "pages/_app" ||
    normalized === "pages/_document"
  );
}

function isInternalEntry(name: string): boolean {
  const normalized = normalizeSlashes(name);
  const base = normalized.split("/").pop() ?? normalized;

  return (
    base === "main" ||
    base === "main-app" ||
    base === "polyfills" ||
    base === "webpack" ||
    base === "app-pages-internals" ||
    base === "middleware" ||
    base === "instrumentation"
  );
}

function routeNameForEntry(name: string): string | null {
  const normalized = normalizeSlashes(name).replace(/^\.\//, "");

  if (normalized.startsWith("app/")) {
    let path = normalized.slice(4);

    if (path === "page") {
      return "/";
    }

    if (path.endsWith("/page")) {
      path = path.slice(0, -"/page".length);
    }

    if (!path || path.endsWith("layout")) {
      return null;
    }

    return `/${path}`;
  }

  if (normalized.startsWith("pages/")) {
    let path = normalized.slice(6);

    if (!path || path.startsWith("_")) {
      return null;
    }

    path = path.replace(/\/?index$/, "");
    return path.length > 0 ? `/${path}` : "/";
  }

  return normalized.length > 0 ? normalized : null;
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function isStyleFile(resource: string): boolean {
  return /\.(css|scss|sass|less|styl|stylus)(\?|$)/i.test(resource);
}

function isScannableSource(resource: string): boolean {
  return /\.(js|jsx|ts|tsx|mjs|cjs|mts|cts|html?|vue|svelte|mdx)(\?|$)/i.test(
    resource,
  );
}

function scanClasses(source: string, classes: Set<string>): void {
  const patterns = [
    /(?:class|className)\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g,
    /(?:^|[,{;\s])(?:class|className)\s*:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g,
    /classList\.(?:add|remove|toggle|contains)\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const value = match[1] ?? match[2] ?? match[3];

      if (!value) {
        continue;
      }

      for (const token of value.split(/\s+/)) {
        if (/^-?[_a-zA-Z][\w-]*$/.test(token)) {
          classes.add(token.toLowerCase());
        }
      }
    }
  }
}

function addCssOwner(
  pagesByCss: Map<string, Set<string>>,
  cssFile: string,
  page: string,
): void {
  const owners = pagesByCss.get(cssFile) ?? new Set<string>();
  owners.add(page);
  pagesByCss.set(cssFile, owners);
}

function uniquePageAssetName(page: string, usedNames: Set<string>): string {
  const safePage =
    page
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "index";
  const base = `static/css/page-${safePage}.css`;
  let fileName = base;
  let index = 2;

  while (usedNames.has(fileName)) {
    fileName = `static/css/page-${safePage}-${index}.css`;
    index += 1;
  }

  return fileName;
}

function collectSyntaxWarnings(
  analysis: JsCssAnalysisResult,
): CssAssetWarning[] {
  return analysis.warnings.map((warning) => ({
    kind: "syntax",
    message: warning.message,
    ...(warning.location
      ? {
          line: warning.location.line,
          column: warning.location.column,
        }
      : {}),
  }));
}

function sourceToString(source: string | Buffer | Uint8Array): string {
  return typeof source === "string"
    ? source
    : Buffer.from(source).toString("utf8");
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) {
    return `${bytes} B`;
  }

  if (bytes < 1_024 * 1_024) {
    return `${(bytes / 1_024).toFixed(1)} KB`;
  }

  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

function roundMs(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
