/** Tier 2: physical size-budget splitting. */
export type SizeBudgetOptions = {
  /** Enable size-budget splitting. @default true */
  enabled?: boolean;
  /** Maximum serialized bytes per body chunk. @default 60 * 1024 */
  maxChunkSize?: number;
  /** Isolate CSS variables before splitting. @default true */
  isolateVariables?: boolean;
};

/** Memory cache configuration. */
export type CssDoctorRemixCacheOptions = {
  /** Enable the optimized-response cache. @default true */
  enabled?: boolean;
  /** Maximum number of cached CSS responses. @default 100 */
  maxEntries?: number;
};

/** Configuration for the Remix 3 asset middleware. */
export type CssDoctorRemixOptions = {
  /** Tier 2 configuration. */
  sizeBudget?: SizeBudgetOptions;
  /** Minify CSS. Defaults to true only when NODE_ENV is production. */
  minify?: boolean;
  /** Memory cache configuration. */
  cache?: CssDoctorRemixCacheOptions;
  /** URL patterns for assets that must not be optimized. */
  exclude?: Array<string | RegExp>;
};

/** The subset of Remix's AssetServer used by this adapter. */
export type RemixAssetServerLike = {
  fetch: (request: Request) => Promise<Response | null>;
};

/** A cached, already-optimized CSS response. */
export type CssCacheEntry = {
  body: string;
  etag: string;
  headers: Array<[string, string]>;
  sizeBytes: number;
};
