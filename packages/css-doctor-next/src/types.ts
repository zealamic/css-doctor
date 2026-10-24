import type {
  JsCssAnalysisResult,
  JsSelectorStat,
} from "@zealamic/css-doctor-binding";

/** Configuration for the Next.js integration. */
export type CssDoctorNextOptions = {
  /**
   * Minimum share of pages that must use a selector before it is placed in the
   * common CSS chunk. Range: 0..1.
   *
   * @default 0.5
   */
  minPageRatio?: number;
  /** Selectors or classes that must always remain in the common chunk. */
  forceCommonSelectors?: string[];
  /** Print the diagnostics matrix during `next build`. @default true */
  report?: boolean;
  /**
   * Explicit page class usage. When provided, it replaces route scanning for
   * coverage calculations while route entrypoints are still used to associate
   * CSS assets with pages.
   */
  pageUsage?: Record<string, string[]>;
  /**
   * Explicit cssd.config.* path. When absent and no inline options are passed,
   * the loader searches the project root.
   */
  configFile?: string;
  /** Called once per client production build with the full diagnostics. */
  onDiagnostics?: (result: CssDoctorNextDiagnostics) => void | Promise<void>;
};

/** Options passed to the internal webpack plugin. */
export type CssDoctorWebpackPluginOptions = Omit<
  CssDoctorNextOptions,
  "configFile"
>;

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
  associatedPages: string[];
  commonSizeBytes: number;
  pageSpecificSizeBytes: number;
  deadCodeCount: number;
};

/** Analysis metadata for one CSS asset. */
export type CssAssetDiagnostic = {
  fileName: string;
  sizeBeforeBytes: number;
  sizeAfterBytes: number;
  selectorCount: number;
  ruleCount: number;
  associatedPages: string[];
  split?: CssAssetSplitInfo;
  warnings: CssAssetWarning[];
  analysis?: JsCssAnalysisResult;
  error?: string;
};

/** A page-specific CSS asset emitted by the plugin. */
export type EmittedPageChunk = {
  page: string;
  fileName: string;
  sizeBytes: number;
};

/** Complete diagnostics emitted by a Next.js client production build. */
export type CssDoctorNextDiagnostics = {
  plugin: "css-doctor-next";
  generatedAt: string;
  durationMs: number;
  minPageRatio: number;
  pages: string[];
  pageUsage: Record<string, number>;
  splitApplied: boolean;
  totalCssAssets: number;
  analyzedCssAssets: number;
  failedCssAssets: number;
  totalSizeBeforeBytes: number;
  totalSizeAfterBytes: number;
  totalSelectors: number;
  totalRules: number;
  commonCssBytes: number;
  pageSpecificCssBytes: number;
  emittedPageChunks: EmittedPageChunk[];
  usageMatrix: JsSelectorStat[];
  deadCodeCount: number;
  files: CssAssetDiagnostic[];
  errors: string[];
};
