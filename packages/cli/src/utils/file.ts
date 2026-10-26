import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import fastGlob from "fast-glob";

const DEFAULT_IGNORES = ["**/node_modules/**", "**/.git/**"];

/** Successful stylesheet read. */
export type CssFileReadSuccess = {
  ok: true;
  content: string;
  sizeBytes: number;
};

/** Failed stylesheet read. */
export type CssFileReadFailure = {
  ok: false;
  error: string;
};

export type CssFileReadResult = CssFileReadSuccess | CssFileReadFailure;

async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

/** Returns `true` when the path exists and is a directory. */
export async function isDirectory(directoryPath: string): Promise<boolean> {
  try {
    return (await stat(directoryPath)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Resolves literal paths and glob patterns into a sorted, de-duplicated list of
 * absolute CSS file paths.
 *
 * Literal paths are checked with `stat` first so filenames containing glob
 * metacharacters (for example `src/[slug].css`) still work when passed
 * directly. Globs automatically ignore `node_modules` and `.git`.
 */
export async function resolveCssFiles(
  patterns: string[],
  cwd: string,
): Promise<string[]> {
  const files = new Set<string>();
  const globPatterns: string[] = [];

  for (const pattern of patterns) {
    const absolutePath = isAbsolute(pattern) ? pattern : resolve(cwd, pattern);
    if (await isFile(absolutePath)) {
      files.add(absolutePath);
    } else {
      globPatterns.push(pattern);
    }
  }

  if (globPatterns.length > 0) {
    const matches = await fastGlob(globPatterns, {
      cwd,
      absolute: true,
      onlyFiles: true,
      unique: true,
      dot: false,
      followSymbolicLinks: true,
      ignore: DEFAULT_IGNORES,
    });

    for (const match of matches) {
      files.add(resolve(match));
    }
  }

  return [...files].sort((left, right) => left.localeCompare(right));
}

/**
 * Reads a stylesheet as UTF-8 and reports its exact byte size.
 *
 * Filesystem errors are returned as data instead of being thrown, allowing the
 * `check` command to report a bad file without aborting the whole run.
 */
export async function readCssFile(
  filePath: string,
): Promise<CssFileReadResult> {
  try {
    const buffer = await readFile(filePath);
    return {
      ok: true,
      content: buffer.toString("utf8"),
      sizeBytes: buffer.byteLength,
    };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to read "${filePath}": ${describeError(error)}`,
    };
  }
}

/** Returns a stable, forward-slash path for terminal and JSON output. */
export function toDisplayPath(filePath: string, cwd: string): string {
  const relativePath = relative(cwd, filePath);
  const displayPath = relativePath.length > 0 ? relativePath : filePath;
  return displayPath.split(sep).join("/");
}

/** Converts an unknown thrown value into a readable string. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
