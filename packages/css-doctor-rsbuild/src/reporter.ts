import pc from "picocolors";

import type { CssDoctorRsbuildDiagnostics } from "./types";

export function printReport(diagnostics: CssDoctorRsbuildDiagnostics): void {
  const status = diagnostics.minify
    ? pc.green("Minified: YES")
    : pc.yellow("Minified: NO");
  const lines = [
    "",
    `${pc.cyan(pc.bold("[css-doctor]"))} ${pc.bold("Rsbuild")} ${pc.dim("·")} ${
      diagnostics.pages.length
    } pages ${pc.dim("·")} ${diagnostics.analyzedCssAssets}/${
      diagnostics.totalCssAssets
    } CSS assets ${pc.dim("·")} ${formatBytes(
      diagnostics.totalOriginalSize,
    )} ${pc.dim("→")} ${formatBytes(diagnostics.totalOptimizedSize)} ${pc.dim(
      "·",
    )} ${formatDuration(diagnostics.durationMs)} ${pc.dim("·")} ${status}`,
  ];

  for (const file of diagnostics.files) {
    if (file.error) {
      lines.push(
        `  ${pc.red("✗")} ${pc.magenta(file.fileName)} ${pc.red(file.error)}`,
      );
      continue;
    }

    lines.push(
      `  ${pc.green("✓")} ${pc.magenta(file.fileName)} ${pc.dim(
        `${formatBytes(file.sizeBeforeBytes)} → ${formatBytes(
          file.sizeAfterBytes,
        )}`,
      )} ${pc.dim("·")} ${file.selectorCount} selectors ${pc.dim(
        "·",
      )} pages: ${file.associatedPages.join(", ") || "none"}`,
    );
    lines.push(
      `      split common ${formatBytes(
        file.sizeAfterBytes,
      )} ${pc.dim("·")} dead ${file.deadCodeCount}`,
    );
  }

  if (diagnostics.emittedPageChunks.length > 0) {
    lines.push("");
    lines.push(
      `  ${pc.bold(`Emitted page chunks (${diagnostics.emittedPageChunks.length})`)}`,
    );

    for (const chunk of diagnostics.emittedPageChunks) {
      lines.push(
        `    ${pc.magenta(chunk.fileName)} ${pc.dim(formatBytes(chunk.sizeBytes))}`,
      );
    }
  }

  lines.push("");
  lines.push(
    `  ${pc.bold("Size budget")} ${pc.dim(
      `(max ${formatBytes(diagnostics.sizeBudget.maxChunkSize)} · variables ${
        diagnostics.sizeBudget.isolateVariables ? "isolated" : "inline"
      })`,
    )}`,
  );

  if (diagnostics.emittedCssChunks.length === 0) {
    lines.push(`    ${pc.dim("No CSS chunks were emitted.")}`);
  } else {
    for (const chunk of diagnostics.emittedCssChunks) {
      const markers: string[] = [];

      if (chunk.isVariableChunk) {
        markers.push("vars");
      }

      if (chunk.isPartChunk) {
        markers.push("part");
      }

      if (chunk.embedded) {
        markers.push("embedded");
      }

      if (chunk.splitDueToSize) {
        markers.push(pc.yellow("split"));
      }

      if (chunk.oversized) {
        markers.push(pc.red("oversized"));
      }

      lines.push(
        `    ${pc.magenta(chunk.fileName)} ${pc.dim(
          formatBytes(chunk.size),
        )}${markers.length > 0 ? ` ${pc.dim("·")} ${markers.join(" · ")}` : ""}`,
      );
    }
  }

  if (diagnostics.deadCodeSelectorsCount > 0) {
    lines.push("");
    lines.push(
      `  ${pc.yellow(
        `⚠ Dead code eliminated: ${diagnostics.deadCodeSelectorsCount} selector occurrences`,
      )}`,
    );
  }

  if (diagnostics.errors.length > 0) {
    lines.push("");
    for (const error of diagnostics.errors) {
      lines.push(`  ${pc.red(`✗ ${error}`)}`);
    }
  }

  console.log(lines.join("\n"));
}

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1) {
    return "<1 ms";
  }

  return `${milliseconds.toFixed(1)} ms`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}
