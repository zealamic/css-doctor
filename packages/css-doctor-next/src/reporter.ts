import picocolors from "picocolors";

import type {
  CssAssetDiagnostic,
  CssAssetWarning,
  CssDoctorNextDiagnostics,
} from "./types";

const MATRIX_SELECTOR_MAX = 36;

/** Options for terminal rendering. Defaults to picocolors' TTY detection. */
export type ReporterOptions = {
  color?: boolean;
};

/** Formats diagnostics as a human-readable build report. */
export function formatDiagnostics(
  diagnostics: CssDoctorNextDiagnostics,
  options: ReporterOptions = {},
): string {
  const colors = picocolors.createColors(
    options.color ?? picocolors.isColorSupported,
  );
  const badge = colors.bgCyan(colors.black("[css-doctor]"));
  const lines: string[] = [];

  lines.push(
    `${badge} Next.js ${diagnostics.pages.length} page${
      diagnostics.pages.length === 1 ? "" : "s"
    } ${colors.dim("·")} ${diagnostics.analyzedCssAssets}/${
      diagnostics.totalCssAssets
    } CSS assets ${colors.dim("·")} ${formatBytes(
      diagnostics.totalSizeBeforeBytes,
    )} → ${formatBytes(diagnostics.totalSizeAfterBytes)} common ` +
      `${colors.dim("·")} ${formatDuration(diagnostics.durationMs)}` +
      ` ${colors.dim("·")} ${
        diagnostics.minify
          ? colors.green("Minified: YES")
          : colors.yellow("Minified: NO")
      }`,
  );

  for (const file of diagnostics.files) {
    lines.push(...formatFile(file, colors));
  }

  if (diagnostics.splitApplied) {
    lines.push("");
    lines.push(...formatMatrix(diagnostics, colors));
  }

  if (diagnostics.emittedPageChunks.length > 0) {
    lines.push("");
    lines.push(
      `  ${colors.bold("Emitted page chunks")} ${colors.dim(
        `(${diagnostics.emittedPageChunks.length})`,
      )}`,
    );

    for (const chunk of diagnostics.emittedPageChunks) {
      lines.push(
        `    ${colors.magenta(chunk.fileName)} ${colors.dim(
          formatBytes(chunk.sizeBytes),
        )}`,
      );
    }
  }

  if (diagnostics.sizeBudget.enabled) {
    lines.push("");
    lines.push(...formatSizeBudget(diagnostics, colors));
  }

  if (diagnostics.deadCodeCount > 0) {
    lines.push("");
    lines.push(
      `  ${colors.yellow("⚠")} ${colors.bold("Dead code eliminated:")} ` +
        `${diagnostics.deadCodeCount} selector occurrence${
          diagnostics.deadCodeCount === 1 ? "" : "s"
        }`,
    );
  }

  if (diagnostics.errors.length > 0) {
    lines.push("");
    lines.push(`  ${colors.red(colors.bold("Errors"))}`);

    for (const error of diagnostics.errors) {
      lines.push(`    ${colors.red("✖")} ${error}`);
    }
  }

  return lines.join("\n");
}

/** Prints diagnostics to stdout. */
export function printDiagnostics(diagnostics: CssDoctorNextDiagnostics): void {
  console.log(formatDiagnostics(diagnostics));
}

function formatFile(
  file: CssAssetDiagnostic,
  colors: ReturnType<typeof picocolors.createColors>,
): string[] {
  const failed = file.error !== undefined;
  const hasWarnings = file.warnings.length > 0;
  const icon = failed
    ? colors.red("✖")
    : hasWarnings
      ? colors.yellow("⚠")
      : colors.green("✓");

  const size = `${formatBytes(file.sizeBeforeBytes)} → ${formatBytes(
    file.sizeAfterBytes,
  )}`;
  const selectors = failed ? "" : ` · ${file.selectorCount} selectors`;
  const pages =
    file.associatedPages.length > 0
      ? ` · pages: ${file.associatedPages.join(", ")}`
      : "";

  const lines = [
    `  ${icon} ${colors.bold(file.fileName)} ${colors.dim(size)}${selectors}${colors.dim(pages)}`,
  ];

  if (file.error) {
    lines.push(`      ${colors.red(file.error)}`);
    return lines;
  }

  if (file.split) {
    lines.push(
      `      ${colors.dim("split")} common ${formatBytes(
        file.split.commonSizeBytes,
      )} ${colors.dim("·")} page-specific ${formatBytes(
        file.split.pageSpecificSizeBytes,
      )} ${colors.dim("·")} dead ${file.split.deadCodeCount}`,
    );
  }

  for (const warning of file.warnings) {
    lines.push(`      ${formatWarning(warning, colors)}`);
  }

  return lines;
}

function formatMatrix(
  diagnostics: CssDoctorNextDiagnostics,
  colors: ReturnType<typeof picocolors.createColors>,
): string[] {
  const pageTotal = diagnostics.pages.length;
  const rows = diagnostics.usageMatrix;
  const header = [
    "Selector".padEnd(MATRIX_SELECTOR_MAX),
    "Total Used".padStart(10),
    "Page Usage".padStart(10),
    "Coverage %".padStart(10),
    "Assigned Chunk",
  ].join("  ");

  const lines = [
    `  ${colors.bold("Usage Matrix")} ${colors.dim(
      `(${rows.length} selectors · ${pageTotal} pages)`,
    )}`,
    `  ${colors.dim(header)}`,
  ];

  for (const row of rows) {
    const selector = truncate(row.selector, MATRIX_SELECTOR_MAX).padEnd(
      MATRIX_SELECTOR_MAX,
    );
    const totalUsed = String(row.totalOccurrences).padStart(10);
    const pageUsage = `${row.pageCount}/${pageTotal}`.padStart(10);
    const coverage = `${(row.coverageRatio * 100).toFixed(1)}%`.padStart(10);
    const chunk = formatChunk(row.targetChunk, colors);

    lines.push(
      `  ${colors.cyan(selector)}  ${totalUsed}  ${pageUsage}  ${colorCoverage(
        coverage,
        row.coverageRatio,
        diagnostics.minPageRatio,
        colors,
      )}  ${chunk}`,
    );
  }

  return lines;
}

function formatSizeBudget(
  diagnostics: CssDoctorNextDiagnostics,
  colors: ReturnType<typeof picocolors.createColors>,
): string[] {
  const budget = diagnostics.sizeBudget;
  const lines = [
    `  ${colors.bold("Size budget")} ${colors.dim(
      `(max ${formatBytes(budget.maxChunkSize)} · variables ${
        budget.isolateVariables ? "isolated" : "inline"
      })`,
    )}`,
  ];
  const chunks = diagnostics.emittedCssChunks;

  if (chunks.length === 0) {
    lines.push(`    ${colors.dim("No CSS chunks were emitted.")}`);
    return lines;
  }

  for (const chunk of chunks) {
    const markers: string[] = [];

    if (chunk.variables) {
      markers.push("vars");
    }

    if (chunk.part !== undefined) {
      markers.push(`part ${chunk.part}`);
    }

    if (chunk.embedded) {
      markers.push("embedded");
    }

    if (chunk.splitDueToSize) {
      markers.push(colors.yellow("split"));
    }

    if (chunk.oversized) {
      markers.push(colors.red("oversized"));
    }

    lines.push(
      `    ${colors.magenta(chunk.fileName)} ${colors.dim(
        formatBytes(chunk.sizeBytes),
      )}${markers.length > 0 ? ` ${colors.dim("·")} ${markers.join(" · ")}` : ""}`,
    );
  }

  if (budget.splitChunks === 0) {
    lines.push(
      `    ${colors.dim("No chunk exceeded the configured size budget.")}`,
    );
  }

  return lines;
}

function formatWarning(
  warning: CssAssetWarning,
  colors: ReturnType<typeof picocolors.createColors>,
): string {
  const location =
    warning.line !== undefined
      ? colors.dim(
          `${warning.line}${
            warning.column !== undefined ? `:${warning.column}` : ""
          } `,
        )
      : "";

  return `${colors.yellow("!")} ${location}${warning.message}`;
}

function colorCoverage(
  coverage: string,
  ratio: number,
  minPageRatio: number,
  colors: ReturnType<typeof picocolors.createColors>,
): string {
  if (ratio === 0) {
    return colors.red(coverage);
  }

  return ratio >= minPageRatio
    ? colors.green(coverage)
    : colors.yellow(coverage);
}

function formatChunk(
  chunk: string,
  colors: ReturnType<typeof picocolors.createColors>,
): string {
  if (chunk === "common") {
    return colors.cyan(chunk);
  }

  if (chunk === "dead") {
    return colors.red(chunk);
  }

  return colors.magenta(chunk);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength
    ? value
    : `${value.slice(0, maxLength - 1)}…`;
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

function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) {
    return "—";
  }

  return milliseconds < 1
    ? `${milliseconds.toFixed(2)} ms`
    : `${milliseconds.toFixed(1)} ms`;
}
