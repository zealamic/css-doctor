import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { performance } from "node:perf_hooks";

import { createFilter } from "@rollup/pluginutils";
import { analyzeCss, splitCssByPages } from "@zealamic/css-doctor-binding";
import type {
  JsCssAnalysisResult,
  JsSelectorStat,
} from "@zealamic/css-doctor-binding";
import type { Plugin } from "vite";

import { printDiagnostics } from "./reporter";
import type {
  CssAssetDiagnostic,
  CssAssetWarning,
  CssDoctorDiagnostics,
  CssDoctorViteOptions,
  EmittedPageChunk,
} from "./types";

const DEFAULT_MIN_PAGE_RATIO = 0.5;
const LARGE_CSS_ASSET_BYTES = 500 * 1_024;

type CssAssetLike = {
  type: "asset";
  fileName: string;
  source: string | Uint8Array;
};

type ViteChunkLike = {
  type: "chunk";
  fileName: string;
  name: string;
  isEntry: boolean;
  facadeModuleId: string | null;
  code: string;
  modules: Record<string, unknown>;
  imports: string[];
  dynamicImports: string[];
  viteMetadata?: {
    importedCss?: Set<string>;
  };
};

type PageInfo = {
  name: string;
  classes: Set<string>;
  cssFiles: Set<string>;
};

type EmitAsset = {
  type: "asset";
  fileName: string;
  source: string | Uint8Array;
};

type AnalysisEnvironment = {
  getModuleInfo: (id: string) => { code?: string | null } | null;
  emitFile: (asset: EmitAsset) => unknown;
};

/**
 * Creates a Vite plugin that splits emitted CSS by page coverage and removes
 * selectors that no scanned page uses.
 *
 * The plugin is read-only with respect to existing assets except for replacing
 * their contents with the common chunk. New page-specific files are emitted
 * with `this.emitFile`. Read, parse, split and callback failures are contained
 * so the user's build is never interrupted.
 */
export function cssDoctor(options: CssDoctorViteOptions = {}): Plugin {
  const minPageRatio = options.minPageRatio ?? DEFAULT_MIN_PAGE_RATIO;
  const report = options.report ?? true;

  if (!Number.isFinite(minPageRatio) || minPageRatio < 0 || minPageRatio > 1) {
    throw new RangeError(
      "css-doctor: minPageRatio must be a number between 0 and 1",
    );
  }

  const filter = createFilter(options.include, options.exclude, {
    resolve: false,
  });

  return {
    name: "vite-plugin-css-doctor",
    apply: "build",
    enforce: "post",

    async generateBundle(_outputOptions, bundle) {
      try {
        const diagnostics = await analyzeAndSplit(
          bundle,
          {
            getModuleInfo: (id) => this.getModuleInfo(id),
            emitFile: (asset) => this.emitFile(asset),
          },
          {
            filter,
            minPageRatio,
            forceCommonSelectors: options.forceCommonSelectors ?? [],
            directPageUsage: options.pageUsage,
          },
        );

        if (options.onDiagnostics) {
          try {
            await options.onDiagnostics(diagnostics);
          } catch (error) {
            const message = `onDiagnostics callback failed: ${describeError(error)}`;
            diagnostics.errors.push(message);
            this.warn(`[css-doctor] ${message}`);
          }
        }

        if (
          report &&
          (diagnostics.totalCssAssets > 0 || diagnostics.errors.length > 0)
        ) {
          printDiagnostics(diagnostics);
        }
      } catch (error) {
        this.warn(
          `[css-doctor] diagnostics failed without interrupting the build: ${describeError(error)}`,
        );
      }
    },
  };
}

type SplitOptions = {
  filter: (id: string) => boolean;
  minPageRatio: number;
  forceCommonSelectors: string[];
  directPageUsage: Record<string, string[]> | undefined;
};

async function analyzeAndSplit(
  bundle: Record<string, unknown>,
  environment: AnalysisEnvironment,
  options: SplitOptions,
): Promise<CssDoctorDiagnostics> {
  const startedAt = performance.now();
  const { pages, pagesByCss } = await collectPages(
    bundle,
    environment.getModuleInfo,
    options.directPageUsage,
  );
  const pageNames = pages.map((page) => page.name);
  const pageNameSet = new Set(pageNames);
  const pageUsage: Record<string, string[]> = {};
  const pageUsageCounts: Record<string, number> = {};

  for (const page of pages) {
    const classes = [...page.classes].sort();
    pageUsage[page.name] = classes;
    pageUsageCounts[page.name] = classes.length;
  }

  const splitApplied = pageNames.length > 0;
  const diagnostics: CssDoctorDiagnostics = {
    plugin: "vite-plugin-css-doctor",
    generatedAt: new Date().toISOString(),
    durationMs: 0,
    minPageRatio: options.minPageRatio,
    pages: pageNames,
    pageUsage: pageUsageCounts,
    splitApplied,
    totalCssAssets: 0,
    analyzedCssAssets: 0,
    skippedCssAssets: 0,
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

  const matrix = new Map<string, JsSelectorStat>();
  const pageCssParts = new Map<string, string[]>();
  const usedFileNames = new Set(Object.keys(bundle));

  for (const output of Object.values(bundle)) {
    if (!isCssAsset(output)) {
      continue;
    }

    diagnostics.totalCssAssets += 1;

    if (!options.filter(output.fileName)) {
      diagnostics.skippedCssAssets += 1;
      continue;
    }

    const associatedPages = [
      ...(pagesByCss.get(output.fileName) ?? pageNameSet),
    ].sort();

    const file = analyzeAsset(output, associatedPages);

    if (file.error) {
      diagnostics.failedCssAssets += 1;
      diagnostics.errors.push(`${file.fileName}: ${file.error}`);
      diagnostics.files.push(file);
      continue;
    }

    const originalContent = sourceToCss(output.source);
    let splitResult: ReturnType<typeof splitCssByPages> | undefined;

    if (splitApplied && file.analysis) {
      try {
        splitResult = splitCssByPages({
          cssContent: originalContent,
          pageUsage,
          config: {
            minPageRatio: options.minPageRatio,
            forceCommonSelectors: options.forceCommonSelectors,
          },
        });

        output.source = splitResult.commonCss;
        file.sizeAfterBytes = Buffer.byteLength(splitResult.commonCss, "utf8");
        file.split = {
          associatedPages,
          commonSizeBytes: file.sizeAfterBytes,
          pageSpecificSizeBytes: 0,
          deadCodeCount: splitResult.deadCodeCount,
        };

        for (const stat of splitResult.stats) {
          const previous = matrix.get(stat.selector);

          if (!previous || stat.totalOccurrences > previous.totalOccurrences) {
            matrix.set(stat.selector, stat);
          }
        }

        let pageSpecificSizeBytes = 0;

        for (const page of associatedPages) {
          const pageCss = splitResult.pageChunks[page];

          if (pageCss && pageCss.trim().length > 0) {
            const parts = pageCssParts.get(page) ?? [];
            parts.push(pageCss);
            pageCssParts.set(page, parts);
            pageSpecificSizeBytes += Buffer.byteLength(pageCss, "utf8");
          }
        }

        file.split.pageSpecificSizeBytes = pageSpecificSizeBytes;
        diagnostics.deadCodeCount += splitResult.deadCodeCount;
      } catch (error) {
        diagnostics.errors.push(
          `${file.fileName}: failed to split CSS: ${describeError(error)}`,
        );
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
      const fileName = uniquePageFileName(page, usedFileNames);
      const sizeBytes = Buffer.byteLength(css, "utf8");

      try {
        environment.emitFile({
          type: "asset",
          fileName,
          source: css,
        });
      } catch (error) {
        diagnostics.errors.push(
          `failed to emit ${fileName}: ${describeError(error)}`,
        );
        continue;
      }

      usedFileNames.add(fileName);

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

  return diagnostics;
}

function analyzeAsset(
  output: CssAssetLike,
  associatedPages: string[],
): CssAssetDiagnostic {
  const analysisStartedAt = performance.now();

  try {
    const css = sourceToCss(output.source);
    const sizeBeforeBytes = Buffer.byteLength(css, "utf8");
    const analysis = analyzeCss(css);
    const warnings = collectSyntaxWarnings(analysis);

    if (sizeBeforeBytes >= LARGE_CSS_ASSET_BYTES) {
      warnings.push({
        kind: "large-asset",
        message:
          `CSS asset is larger than ${formatBytes(LARGE_CSS_ASSET_BYTES)}; ` +
          "consider route-level code splitting.",
      });
    }

    return {
      fileName: output.fileName,
      sizeBeforeBytes,
      sizeAfterBytes: sizeBeforeBytes,
      selectorCount: analysis.stats.selectorCount,
      ruleCount: analysis.stats.ruleCount,
      declarationCount: analysis.stats.declarationCount,
      importantDeclarationCount: analysis.stats.importantDeclarationCount,
      uniqueClassCount: analysis.stats.uniqueClassCount,
      uniqueIdCount: analysis.stats.uniqueIdCount,
      uniqueTagCount: analysis.stats.uniqueTagCount,
      syntaxWarningCount: analysis.warnings.length,
      analysisMs: roundMs(performance.now() - analysisStartedAt),
      associatedPages,
      warnings,
      analysis,
    };
  } catch (error) {
    return {
      fileName: output.fileName,
      sizeBeforeBytes: 0,
      sizeAfterBytes: 0,
      selectorCount: 0,
      ruleCount: 0,
      declarationCount: 0,
      importantDeclarationCount: 0,
      uniqueClassCount: 0,
      uniqueIdCount: 0,
      uniqueTagCount: 0,
      syntaxWarningCount: 0,
      analysisMs: roundMs(performance.now() - analysisStartedAt),
      associatedPages,
      warnings: [],
      error: describeError(error),
    };
  }
}

async function collectPages(
  bundle: Record<string, unknown>,
  getModuleInfo: AnalysisEnvironment["getModuleInfo"],
  directPageUsage: Record<string, string[]> | undefined,
): Promise<{
  pages: PageInfo[];
  pagesByCss: Map<string, Set<string>>;
}> {
  const chunks = Object.values(bundle).filter(isChunk);
  const chunksByFileName = new Map(
    chunks.map((chunk) => [chunk.fileName, chunk]),
  );
  const pages = new Map<string, PageInfo>();
  const entryFileNames = new Set(
    chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName),
  );

  for (const entry of chunks.filter((chunk) => chunk.isEntry)) {
    const shell = collectChunkContent(
      entry,
      chunksByFileName,
      getModuleInfo,
      false,
    );

    if (entry.facadeModuleId && isHtmlFile(entry.facadeModuleId)) {
      try {
        scanClasses(
          await readFile(entry.facadeModuleId, "utf8"),
          shell.classes,
        );
      } catch {
        // The HTML source may be virtual or removed by another plugin. The
        // generated chunk code and pageUsage option still provide coverage.
      }
    }

    const routeChunks = entry.dynamicImports
      .map((fileName) => chunksByFileName.get(fileName))
      .filter((chunk): chunk is ViteChunkLike => chunk !== undefined);

    if (routeChunks.length > 0) {
      // A SPA shell usually owns the HTML, navigation and global CSS, while
      // every direct dynamic import is a route. Treat those chunks as pages
      // and apply the shell classes/CSS to each one, instead of collapsing all
      // routes into the single index entry.
      for (const routeChunk of routeChunks) {
        const page: PageInfo = {
          name: uniquePageName(pageNameFor(routeChunk).toLowerCase(), pages),
          classes: new Set(shell.classes),
          cssFiles: new Set(shell.cssFiles),
        };
        const route = collectChunkContent(
          routeChunk,
          chunksByFileName,
          getModuleInfo,
          true,
          entryFileNames,
        );

        for (const className of route.classes) {
          page.classes.add(className);
        }

        for (const cssFile of route.cssFiles) {
          page.cssFiles.add(cssFile);
        }

        pages.set(page.name, page);
      }

      continue;
    }

    const page: PageInfo = {
      name: uniquePageName(pageNameFor(entry), pages),
      classes: new Set(shell.classes),
      cssFiles: new Set(shell.cssFiles),
    };

    pages.set(page.name, page);
  }

  if (directPageUsage) {
    for (const [rawName, classes] of Object.entries(directPageUsage)) {
      const name = rawName.trim();

      if (name.length === 0) {
        continue;
      }

      let page = pages.get(name);

      if (!page) {
        page = {
          name,
          classes: new Set(),
          cssFiles: new Set(),
        };
        pages.set(name, page);
      }

      for (const className of classes) {
        page.classes.add(className.toLowerCase());
      }
    }
  }

  const pagesByCss = new Map<string, Set<string>>();

  for (const page of pages.values()) {
    for (const cssFile of page.cssFiles) {
      const owners = pagesByCss.get(cssFile) ?? new Set<string>();
      owners.add(page.name);
      pagesByCss.set(cssFile, owners);
    }
  }

  return {
    pages: [...pages.values()],
    pagesByCss,
  };
}

function collectChunkContent(
  startChunk: ViteChunkLike,
  chunksByFileName: Map<string, ViteChunkLike>,
  getModuleInfo: AnalysisEnvironment["getModuleInfo"],
  includeDynamicImports: boolean,
  skipFileNames: ReadonlySet<string> = new Set<string>(),
): {
  classes: Set<string>;
  cssFiles: Set<string>;
} {
  const classes = new Set<string>();
  const cssFiles = new Set<string>();
  const visited = new Set<string>();
  const stack = [startChunk.fileName];

  while (stack.length > 0) {
    const fileName = stack.pop();

    if (!fileName || visited.has(fileName) || skipFileNames.has(fileName)) {
      continue;
    }

    visited.add(fileName);

    const chunk = chunksByFileName.get(fileName);

    if (!chunk) {
      continue;
    }

    scanClasses(chunk.code, classes);

    for (const moduleId of Object.keys(chunk.modules)) {
      if (isStyleModule(moduleId)) {
        continue;
      }

      const moduleInfo = getModuleInfo(moduleId);

      if (moduleInfo?.code) {
        scanClasses(moduleInfo.code, classes);
      }
    }

    for (const cssFile of chunk.viteMetadata?.importedCss ?? []) {
      cssFiles.add(cssFile);
    }

    stack.push(...chunk.imports);

    if (includeDynamicImports) {
      stack.push(...chunk.dynamicImports);
    }
  }

  return { classes, cssFiles };
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

function pageNameFor(chunk: ViteChunkLike): string {
  if (chunk.name.length > 0) {
    return chunk.name;
  }

  if (chunk.facadeModuleId) {
    return basename(chunk.facadeModuleId, extname(chunk.facadeModuleId));
  }

  return chunk.fileName.replace(/\.[^.]+$/, "");
}

function uniquePageName(base: string, pages: Map<string, PageInfo>): string {
  const normalized = base.trim() || "page";

  if (!pages.has(normalized)) {
    return normalized;
  }

  let index = 2;

  while (pages.has(`${normalized}-${index}`)) {
    index += 1;
  }

  return `${normalized}-${index}`;
}

function uniquePageFileName(page: string, usedFileNames: Set<string>): string {
  const safePage =
    page
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "index";
  const base = `page-${safePage}.css`;
  let fileName = base;
  let index = 2;

  while (usedFileNames.has(fileName)) {
    fileName = `page-${safePage}-${index}.css`;
    index += 1;
  }

  return fileName;
}

function isCssAsset(value: unknown): value is CssAssetLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    type?: unknown;
    fileName?: unknown;
    source?: unknown;
  };

  return (
    candidate.type === "asset" &&
    typeof candidate.fileName === "string" &&
    candidate.fileName.endsWith(".css") &&
    (typeof candidate.source === "string" ||
      candidate.source instanceof Uint8Array)
  );
}

function isChunk(value: unknown): value is ViteChunkLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as {
    type?: unknown;
    fileName?: unknown;
    name?: unknown;
    isEntry?: unknown;
    facadeModuleId?: unknown;
    code?: unknown;
    modules?: unknown;
    imports?: unknown;
    dynamicImports?: unknown;
  };

  return (
    candidate.type === "chunk" &&
    typeof candidate.fileName === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.isEntry === "boolean" &&
    typeof candidate.code === "string" &&
    typeof candidate.modules === "object" &&
    candidate.modules !== null &&
    Array.isArray(candidate.imports) &&
    Array.isArray(candidate.dynamicImports)
  );
}

function isStyleModule(moduleId: string): boolean {
  return /\.(css|scss|sass|less|styl|stylus)(\?|$)/i.test(moduleId);
}

function isHtmlFile(moduleId: string): boolean {
  return /\.(html?|vue)$/i.test(moduleId);
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

function sourceToCss(source: string | Uint8Array): string {
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
