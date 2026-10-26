import type { CssCacheEntry } from "./types";

/**
 * Small insertion-ordered LRU cache for optimized CSS responses.
 *
 * The map keeps the least-recently-used entry first. Reading an entry moves it
 * to the end; writing above capacity evicts the first entry.
 */
export class CssCacheManager {
  private readonly entries = new Map<string, CssCacheEntry>();
  private readonly maxEntries: number;

  constructor(maxEntries: number = 100) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
  }

  get(key: string): CssCacheEntry | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry;
  }

  set(key: string, entry: CssCacheEntry): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    this.entries.set(key, entry);

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;

      if (oldest === undefined) {
        break;
      }

      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
