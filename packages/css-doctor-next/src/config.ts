import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createJiti } from "jiti";

import type { CssDoctorNextOptions } from "./types";

const CONFIG_FILENAMES = [
  "cssd.config.ts",
  "cssd.config.mts",
  "cssd.config.cts",
  "cssd.config.js",
  "cssd.config.mjs",
  "cssd.config.cjs",
];

/** Result of attempting to load the central css-doctor config file. */
export type LoadedCssDoctorConfig = {
  options: CssDoctorNextOptions;
  file?: string;
  error?: string;
};

/**
 * Finds `cssd.config.*` starting at `cwd` and walking up to the filesystem
 * root. Returns the absolute path or `null`.
 */
export function findCssDoctorConfig(
  cwd: string = process.cwd(),
): string | null {
  let directory = resolve(cwd);

  while (true) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = resolve(directory, filename);

      if (existsSync(candidate)) {
        return candidate;
      }
    }

    const parent = dirname(directory);

    if (parent === directory) {
      return null;
    }

    directory = parent;
  }
}

/**
 * Loads `cssd.config.ts|js|mjs` synchronously using jiti.
 *
 * Invalid or missing config files are reported through `error` instead of
 * throwing, so a broken css-doctor config cannot prevent Next.js from starting.
 */
export function loadCssDoctorConfig(
  options: { cwd?: string; configFile?: string } = {},
): LoadedCssDoctorConfig {
  const cwd = resolve(options.cwd ?? process.cwd());
  const file = options.configFile
    ? resolve(cwd, options.configFile)
    : findCssDoctorConfig(cwd);

  if (!file) {
    return { options: {} };
  }

  if (!existsSync(file)) {
    return {
      options: {},
      file,
      error: `css-doctor config file not found: ${file}`,
    };
  }

  try {
    const jiti = createJiti(import.meta.url, {
      interopDefault: true,
      fsCache: false,
      moduleCache: false,
    });
    const loaded = jiti(file) as unknown;
    return {
      options: normalizeConfig(loaded),
      file,
    };
  } catch (error) {
    return {
      options: {},
      file,
      error:
        `failed to load ${file}: ` +
        (error instanceof Error ? error.message : String(error)),
    };
  }
}

function normalizeConfig(value: unknown): CssDoctorNextOptions {
  let candidate = value;

  if (isRecord(candidate) && "default" in candidate) {
    candidate = candidate.default;
  }

  if (isRecord(candidate) && "cssDoctor" in candidate) {
    candidate = candidate.cssDoctor;
  }

  return isRecord(candidate) ? (candidate as CssDoctorNextOptions) : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
