import type { CheckReport } from "../commands/check";

/** Formats a check report as pretty-printed JSON for CI/CD integration. */
export function formatJsonReport(report: CheckReport): string {
  return JSON.stringify(report, null, 2);
}
