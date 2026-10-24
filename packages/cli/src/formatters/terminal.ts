import picocolors from "picocolors";

import type {
  CheckIssue,
  CheckReport,
  FileCheckResult,
} from "../commands/check";

const TOP_SELECTOR_LIMIT = 5;

type Status = "SUCCESS" | "WARNING" | "ERROR";
type Palette = ReturnType<typeof picocolors.createColors>;

/** Options for terminal rendering. Defaults to picocolors' TTY detection. */
export type TerminalFormatOptions = {
  color?: boolean;
};

/**
 * Exit code contract for `css-doctor check`.
 *
 * Warnings and hints are recoverable and keep the exit code at 0. Only fatal
 * setup errors or files that fail to read/parse produce exit code 1.
 */
export function terminalExitCode(report: CheckReport): 0 | 1 {
  return report.success ? 0 : 1;
}

/** Formats a check report as a human-readable terminal report. */
export function formatTerminalReport(
  report: CheckReport,
  options: TerminalFormatOptions = {},
): string {
  const colors = picocolors.createColors(
    options.color ?? picocolors.isColorSupported,
  );
  const lines: string[] = [];
  const separator = colors.dim("─".repeat(64));

  lines.push(
    `${colors.bold(colors.cyan("css-doctor"))} ${colors.dim(`v${report.version}`)} ` +
      `${colors.dim("·")} ${colors.dim("check")}`,
  );
  lines.push(
    `${colors.dim("patterns")} ${
      report.patterns.length > 0 ? report.patterns.join(", ") : "(none)"
    }`,
  );
  lines.push(separator);

  if (report.errors.length > 0) {
    lines.push(colors.red(colors.bold("ERRORS")));
    for (const error of report.errors) {
      lines.push(`  ${colors.red("✖")} ${error}`);
    }
    lines.push("");
  }

  for (const file of report.files) {
    lines.push(...formatFile(file, colors));
  }

  if (report.files.length === 0 && report.errors.length === 0) {
    lines.push(colors.yellow("No files were analyzed."));
    lines.push("");
  }

  lines.push(separator);
  lines.push(...formatSummary(report, colors));

  return lines.join("\n");
}

function formatFile(file: FileCheckResult, colors: Palette): string[] {
  const status = fileStatus(file);
  const lines: string[] = [];

  lines.push(
    `${statusBadge(status, colors)} ${colors.bold(file.path)} ` +
      `${colors.dim(`· ${formatBytes(file.sizeBytes)}`)}`,
  );

  if (!file.ok) {
    lines.push(`  ${colors.red(file.error ?? "Unknown error")}`);
    lines.push("");
    return lines;
  }

  const result = file.result;
  if (!result) {
    lines.push(`  ${colors.red("No analysis result was returned.")}`);
    lines.push("");
    return lines;
  }

  const { stats } = result;

  lines.push(
    `  ${colors.dim("selectors")} ${stats.selectorCount} ` +
      `${colors.dim("·")} ${colors.dim("rules")} ${stats.ruleCount} ` +
      `${colors.dim("·")} ${colors.dim("declarations")} ${
        stats.declarationCount + stats.importantDeclarationCount
      }`,
  );
  lines.push(
    `  ${colors.dim("analysis")} ${formatDuration(file.analysisMs)} ` +
      `${colors.dim("·")} ${colors.dim("read")} ${formatDuration(file.readMs)} ` +
      `${colors.dim("·")} ${colors.dim("total")} ${formatDuration(file.totalMs)}`,
  );

  if (file.issues.length > 0) {
    lines.push("");
    lines.push(
      `  ${colors.yellow("⚠")} ${colors.bold("Diagnostics")} ` +
        `${colors.dim(`(${file.issues.length})`)}`,
    );

    for (const issue of file.issues) {
      lines.push(`    ${formatIssue(issue, colors)}`);
    }
  }

  if (result.selectors.length > 0) {
    lines.push("");
    lines.push(...formatTopSelectors(result, colors));
  }

  lines.push("");
  return lines;
}

function formatTopSelectors(
  result: NonNullable<FileCheckResult["result"]>,
  colors: Palette,
): string[] {
  const top = topSelectors(result.selectors, TOP_SELECTOR_LIMIT);
  const total = result.selectors.length;
  const heading =
    total > top.length
      ? `Top selectors (${top.length} of ${total})`
      : `Top selectors (${total})`;

  const lines = [`  ${colors.bold(heading)}`];

  top.forEach((selector, index) => {
    const frequency =
      selector.count > 1 ? ` ${colors.yellow(`×${selector.count}`)}` : "";

    lines.push(
      `    ${colors.dim(`${String(index + 1).padStart(2, " ")}.`)} ` +
        `${selector.raw}${frequency} ` +
        `${colors.dim(`(${selector.specificity})`)}`,
    );
  });

  return lines;
}

type TopSelector = {
  raw: string;
  count: number;
  firstIndex: number;
  specificity: string;
};

function topSelectors(
  selectors: Array<{
    raw: string;
    specificity: { ids: number; classes: number; types: number };
  }>,
  limit: number,
): TopSelector[] {
  const entries = new Map<string, TopSelector>();

  selectors.forEach((selector, index) => {
    const existing = entries.get(selector.raw);

    if (existing) {
      existing.count += 1;
      return;
    }

    entries.set(selector.raw, {
      raw: selector.raw,
      count: 1,
      firstIndex: index,
      specificity: `${selector.specificity.ids},${selector.specificity.classes},${selector.specificity.types}`,
    });
  });

  return [...entries.values()]
    .sort(
      (left, right) =>
        right.count - left.count || left.firstIndex - right.firstIndex,
    )
    .slice(0, limit);
}

function formatIssue(issue: CheckIssue, colors: Palette): string {
  const location = issue.location
    ? `${issue.location.line}:${issue.location.column}`
    : "—";

  const tag =
    issue.kind === "syntax"
      ? colors.yellow("syntax")
      : issue.kind === "threshold"
        ? colors.yellow("threshold")
        : issue.kind === "empty-rule"
          ? colors.magenta("dead code")
          : colors.magenta("duplicate");

  return `${colors.dim(location.padEnd(7))} ${tag}  ${issue.message}`;
}

function formatSummary(report: CheckReport, colors: Palette): string[] {
  const { summary } = report;
  const status = reportStatus(report);
  const lines: string[] = [];

  lines.push(
    `${statusBadge(status, colors)} ${summary.files} file${
      summary.files === 1 ? "" : "s"
    } ${colors.dim("·")} ${formatBytes(summary.totalSizeBytes)} ` +
      `${colors.dim("·")} ${summary.selectors} selectors ` +
      `${colors.dim("·")} ${formatDuration(summary.totalMs)}`,
  );
  lines.push(
    `  ${colors.dim("analyzed")} ${summary.analyzed} ` +
      `${colors.dim("·")} ${colors.dim("failed")} ${summary.failed} ` +
      `${colors.dim("·")} ${colors.dim("warnings")} ${summary.warnings} ` +
      `${colors.dim("·")} ${colors.dim("hints")} ${summary.hints}`,
  );
  lines.push(
    `  ${colors.dim("rules")} ${summary.rules} ` +
      `${colors.dim("·")} ${colors.dim("declarations")} ${summary.declarations} ` +
      `${colors.dim("·")} ${colors.dim("analysis")} ${formatDuration(summary.analysisMs)}`,
  );

  if (report.threshold !== null) {
    lines.push(`  ${colors.dim("selector threshold")} ${report.threshold}`);
  }

  return lines;
}

function fileStatus(file: FileCheckResult): Status {
  if (!file.ok) {
    return "ERROR";
  }

  return file.issues.length > 0 ? "WARNING" : "SUCCESS";
}

function reportStatus(report: CheckReport): Status {
  if (
    !report.success ||
    report.errors.length > 0 ||
    report.summary.failed > 0
  ) {
    return "ERROR";
  }

  return report.summary.issues > 0 ? "WARNING" : "SUCCESS";
}

function statusBadge(status: Status, colors: Palette): string {
  switch (status) {
    case "SUCCESS":
      return colors.bgGreen(colors.black(" SUCCESS "));
    case "WARNING":
      return colors.bgYellow(colors.black(" WARNING "));
    case "ERROR":
      return colors.bgRed(colors.white(" ERROR "));
  }
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
