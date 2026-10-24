import type {
  JsCssAnalysisResult,
  JsSelectorStat,
} from "@zealamic/css-doctor-binding";

/** A single include/exclude filter entry. */
export type CssDoctorFilterPattern = string | RegExp;

/** Include/exclude filters accepted by the plugin. */
export type CssDoctorFilter = CssDoctorFilterPattern | CssDoctorFilterPattern[];

/** Configuration for {@link cssDoctor}. */
export type CssDoctorViteOptions = {
  /**
   * Minimum share of pages that must use a selector before it is placed in the
   * common CSS chunk. Range: 0..1.
   *
   * @default 0.5
   */
  minPageRatio?: number;
  /**
   * Selectors or class names that must always stay in the common chunk even
   * when no scanned page uses them.
   */
  forceCommonSelectors?: string[];
  /** Print the diagnostics table to the terminal after analysis. @default true */
  report?: boolean;
  /** Only analyze CSS assets whose emitted file name matches these patterns. */
  include?: CssDoctorFilter;
  /** Skip CSS assets whose emitted file name matches these patterns. */
  exclude?: CssDoctorFilter;
  /**
   * Explicit page class usage, merged with classes scanned from entry HTML/JS
   * chunks. Useful for pages rendered by a framework or content not present in
   * the Vite module graph.
   */
  pageUsage?: Record<string, string[]>;
  /** Called once per build with the full diagnostics payload. */
  onDiagnostics?: (result: CssDoctorDiagnostics) => void | Promise<void>;
};

export type CssAssetWarningKind = "syntax" | "large-asset";

/** A non-fatal warning attached to a CSS asset. */
export type CssAssetWarning = {
  kind: CssAssetWarningKind;
  message: string;
  line?: number;
  column?: number;
};

/** Page-coverage split metadata for one CSS asset. */
export type CssAssetSplitInfo = {
  /** Pages that load this asset. */
  associatedPages: string[];
  /** Bytes remaining in the asset after page-specific rules were removed. */
  commonSizeBytes: number;
  /** Page-specific bytes contributed by this asset. */
  pageSpecificSizeBytes: number;
  /** Dead selector occurrences removed from this asset. */
  deadCodeCount: number;
};

/** Analysis metadata for one emitted CSS asset. */
export type CssAssetDiagnostic = {
  /** Emitted path inside the bundle, e.g. `assets/index-abc123.css`. */
  fileName: string;
  /** Byte size before analysis/splitting. */
  sizeBeforeBytes: number;
  /** Byte size after splitting (the common chunk). */
  sizeAfterBytes: number;
  selectorCount: number;
  ruleCount: number;
  declarationCount: number;
  importantDeclarationCount: number;
  uniqueClassCount: number;
  uniqueIdCount: number;
  uniqueTagCount: number;
  syntaxWarningCount: number;
  /** Time spent inside the native analyzer for this asset. */
  analysisMs: number;
  /** Pages that load this asset. */
  associatedPages: string[];
  /** Present when page-coverage splitting ran for this asset. */
  split?: CssAssetSplitInfo;
  /** Warnings that should be surfaced to the developer. */
  warnings: CssAssetWarning[];
  /** Full native analysis result, useful for custom tooling. */
  analysis?: JsCssAnalysisResult;
  /** Present when the asset could not be read or analyzed. */
  error?: string;
};

/** A page-specific CSS file emitted by the plugin. */
export type EmittedPageChunk = {
  page: string;
  fileName: string;
  sizeBytes: number;
};

/** Complete diagnostics emitted by a Vite build. */
export type CssDoctorDiagnostics = {
  plugin: "vite-plugin-css-doctor";
  generatedAt: string;
  /** Time spent scanning, analyzing, splitting and emitting. */
  durationMs: number;
  minPageRatio: number;
  pages: string[];
  /** Number of scanned classes per page. */
  pageUsage: Record<string, number>;
  splitApplied: boolean;
  /** Number of `.css` assets found in the bundle. */
  totalCssAssets: number;
  analyzedCssAssets: number;
  skippedCssAssets: number;
  failedCssAssets: number;
  totalSizeBeforeBytes: number;
  totalSizeAfterBytes: number;
  totalSelectors: number;
  totalRules: number;
  /** Total bytes left in common CSS assets after splitting. */
  commonCssBytes: number;
  /** Total bytes of emitted page-specific CSS. */
  pageSpecificCssBytes: number;
  emittedPageChunks: EmittedPageChunk[];
  /** Selector usage matrix produced by the native splitter. */
  usageMatrix: JsSelectorStat[];
  /** Number of dead selector occurrences removed. */
  deadCodeCount: number;
  files: CssAssetDiagnostic[];
  /** Fatal-to-diagnostics (but non-fatal to Vite) errors. */
  errors: string[];
};
