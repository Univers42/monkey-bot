import { resolve } from "node:path";
import type {
  ExecutionContext,
  ReporterHooks,
  RunResult,
  ScenarioResult
} from "./core.ts";

const ANSI = {
  reset: "\u001B[0m",
  bold: "\u001B[1m",
  dim: "\u001B[2m",
  red: "\u001B[31m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  blue: "\u001B[34m",
  magenta: "\u001B[35m",
  cyan: "\u001B[36m",
  gray: "\u001B[90m"
} as const;

type Tone = "accent" | "info" | "muted" | "success" | "failure" | "warning" | "heading";

function pad(text: string, size: number): string {
  return text.length >= size ? text : `${text}${".".repeat(size - text.length)}`;
}

function colorsEnabled(stream: { isTTY?: boolean } = process.stdout): boolean {
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }
  if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== "0") {
    return true;
  }
  return Boolean(stream.isTTY);
}

function tone(text: string, variant: Tone, enabled = colorsEnabled()): string {
  if (!enabled) {
    return text;
  }

  const styles = {
    accent: [ANSI.blue],
    info: [ANSI.cyan],
    muted: [ANSI.dim, ANSI.gray],
    success: [ANSI.bold, ANSI.green],
    failure: [ANSI.bold, ANSI.red],
    warning: [ANSI.bold, ANSI.yellow],
    heading: [ANSI.bold, ANSI.cyan]
  } satisfies Record<Tone, string[]>;

  return `${styles[variant].join("")}${text}${ANSI.reset}`;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${durationMs}ms`;
  }

  const totalSeconds = Math.round(durationMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s` : `${seconds}s`;
}

function formatStatus(status: ScenarioResult["status"], enabled = colorsEnabled()): string {
  const upper = status.toUpperCase();
  if (status === "passed") {
    return tone(upper, "success", enabled);
  }
  if (status === "failed") {
    return tone(upper, "failure", enabled);
  }
  return tone(upper, "warning", enabled);
}

function label(name: string, enabled = colorsEnabled()): string {
  return tone(`${name}:`, "muted", enabled);
}

function keyValue(name: string, value: string | number, enabled = colorsEnabled()): string {
  return `${label(name, enabled)} ${value}`;
}

function failureLines(scenario: ScenarioResult, colored = false): string[] {
  const firstArtifact = scenario.artifacts[0];
  const scenarioId = colored ? tone(scenario.id, "failure", true) : scenario.id;
  const reason = colored
    ? tone(scenario.errors[0] ?? "Unknown failure", "failure", true)
    : scenario.errors[0] ?? "Unknown failure";
  const artifact = colored && firstArtifact ? tone(firstArtifact, "accent", true) : firstArtifact ?? "none";

  return [
    `- ${scenarioId}`,
    `  ${colored ? label("Reason", true) : "Reason:"} ${reason}`,
    `  ${colored ? label("Attempts", true) : "Attempts:"} ${scenario.attempts}`,
    `  ${colored ? label("Artifact", true) : "Artifact:"} ${artifact}`
  ];
}

export function createTerminalReporter(): ReporterHooks {
  const colored = colorsEnabled();

  return {
    onRunStart(run, scenarios) {
      process.stdout.write(
        [
          tone("QA Run", "heading", colored),
          keyValue("Project", run.project, colored),
          keyValue("Environment", run.env, colored),
          keyValue("Run ID", run.runId, colored),
          keyValue("Selection", run.flags.scenario ?? run.flags.suite ?? "custom", colored),
          keyValue("Workers", run.flags.workers, colored),
          keyValue("Scenarios", scenarios.length, colored),
          ""
        ].join("\n")
      );
    },
    onScenarioStart(_run, scenario) {
      process.stdout.write(`${tone("▶", "info", colored)} Running ${tone(scenario.id, "accent", colored)}...\n`);
    },
    onScenarioComplete(_run, scenario) {
      process.stdout.write(
        `${pad(`Scenario: ${scenario.id}`, 42)} ${formatStatus(scenario.status, colored)} ${tone(
          formatDuration(scenario.durationMs),
          "muted",
          colored
        )}\n`
      );
    },
    onRunComplete(run) {
      const failures = run.scenarios.filter((scenario) => scenario.status === "failed");
      process.stdout.write(
        [
          "",
          keyValue("Passed", tone(String(run.summary.passed), "success", colored), colored),
          keyValue("Failed", tone(String(run.summary.failed), "failure", colored), colored),
          keyValue("Skipped", tone(String(run.summary.skipped), "warning", colored), colored),
          keyValue("Flaky", run.summary.flaky, colored),
          keyValue("Duration", formatDuration(run.durationMs), colored),
          keyValue("Reports", tone(run.reportDir, "accent", colored), colored),
          failures.length === 0 ? tone("All scenarios completed without failures.", "success", colored) : "",
          failures.length === 0 ? "" : `\n${tone("Failures", "failure", colored)}:`,
          ...failures.flatMap((scenario) => failureLines(scenario, colored)),
          ""
        ].join("\n")
      );
    }
  };
}

export function renderSummary(run: RunResult, colored = false): string {
  const failures = run.scenarios.filter((scenario) => scenario.status === "failed");

  return [
    colored ? tone("QA Summary", "heading") : "QA Summary",
    keyValue("Project", run.project, colored),
    keyValue("Environment", run.env, colored),
    keyValue("Run ID", run.runId, colored),
    keyValue("Suite", run.suite ?? "-", colored),
    keyValue("Scenario", run.scenario ?? "-", colored),
    keyValue("Concurrency", run.concurrency ?? "mixed", colored),
    keyValue("Workers", run.workers, colored),
    "",
    ...run.scenarios.map(
      (scenario) =>
        `${pad(`Scenario: ${scenario.id}`, 42)} ${
          colored ? formatStatus(scenario.status, true) : scenario.status.toUpperCase()
        } ${
          colored ? tone(formatDuration(scenario.durationMs), "muted", true) : formatDuration(scenario.durationMs)
        }`
    ),
    "",
    keyValue("Passed", colored ? tone(String(run.summary.passed), "success", true) : run.summary.passed, colored),
    keyValue("Failed", colored ? tone(String(run.summary.failed), "failure", true) : run.summary.failed, colored),
    keyValue("Skipped", colored ? tone(String(run.summary.skipped), "warning", true) : run.summary.skipped, colored),
    keyValue("Flaky", run.summary.flaky, colored),
    keyValue("Duration", formatDuration(run.durationMs), colored),
    failures.length === 0 ? "" : `\n${colored ? tone("Failures", "failure", true) : "Failures"}:`,
    ...failures.flatMap((scenario) => failureLines(scenario, colored)),
    ""
  ].join("\n");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

export function toJunit(run: RunResult): string {
  const tests = run.scenarios.length;
  const failures = run.summary.failed;
  const skipped = run.summary.skipped;
  const testcases = run.scenarios
    .map((scenario) => {
      if (scenario.status === "failed") {
        return `<testcase classname="${escapeXml(run.project)}" name="${escapeXml(scenario.id)}" time="${(
          scenario.durationMs / 1000
        ).toFixed(3)}"><failure message="${escapeXml(scenario.errors[0] ?? "Scenario failed")}">${escapeXml(
          scenario.errors.join("\n")
        )}</failure></testcase>`;
      }
      if (scenario.status === "skipped") {
        return `<testcase classname="${escapeXml(run.project)}" name="${escapeXml(scenario.id)}" time="${(
          scenario.durationMs / 1000
        ).toFixed(3)}"><skipped message="${escapeXml(scenario.errors[0] ?? "Scenario skipped")}" /></testcase>`;
      }
      return `<testcase classname="${escapeXml(run.project)}" name="${escapeXml(scenario.id)}" time="${(
        scenario.durationMs / 1000
      ).toFixed(3)}" />`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><testsuite name="${escapeXml(
    run.project
  )}" tests="${tests}" failures="${failures}" skipped="${skipped}" time="${(run.durationMs / 1000).toFixed(
    3
  )}">${testcases}</testsuite>`;
}

export function toHtml(run: RunResult): string {
  const rows = run.scenarios
    .map(
      (scenario) =>
        `<tr><td>${scenario.id}</td><td>${scenario.suite}</td><td>${scenario.status}</td><td>${formatDuration(
          scenario.durationMs
        )}</td><td>${scenario.errors[0] ?? ""}</td></tr>`
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8" /><title>${run.project} QA Report</title><style>body{font-family:ui-monospace,monospace;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body><h1>${run.project} QA Report</h1><p>Run ID: ${run.runId}</p><p>Environment: ${run.env}</p><p>Summary: ${run.summary.passed} passed, ${run.summary.failed} failed, ${run.summary.skipped} skipped</p><table><thead><tr><th>Scenario</th><th>Suite</th><th>Status</th><th>Duration</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function reportFiles(run: RunResult): Record<string, string> {
  return {
    "results.json": JSON.stringify(run, null, 2),
    "summary.txt": renderSummary(run, false),
    "junit.xml": toJunit(run),
    "html/index.html": toHtml(run)
  };
}

export function printDoctor(run: ExecutionContext, checks: Array<{ name: string; ok: boolean; details: string }>): void {
  const colored = colorsEnabled();

  process.stdout.write(
    [
      tone("QA Doctor", "heading", colored),
      keyValue("Project", run.project, colored),
      keyValue("Environment", run.env, colored),
      keyValue("Run ID", run.runId, colored),
      "",
      ...checks.map((check) => {
        const status = check.ok ? tone("OK ", "success", colored) : tone("NO ", "failure", colored);
        const details = check.ok ? check.details : tone(check.details, "warning", colored);
        return `${status} ${pad(check.name, 28)} ${details}`;
      }),
      ""
    ].join("\n")
  );
}

export function printList(title: string, rows: string[]): void {
  const colored = colorsEnabled();
  process.stdout.write([
    tone(title, "heading", colored),
    ...rows.map((row) => {
      if (!colored || !row.startsWith("- ")) {
        return row;
      }
      const content = row.slice(2);
      const split = content.indexOf(" ");
      if (split < 0) {
        return `${tone("-", "info", true)} ${tone(content, "accent", true)}`;
      }
      return `${tone("-", "info", true)} ${tone(content.slice(0, split), "accent", true)}${content.slice(split)}`;
    }),
    ""
  ].join("\n"));
}

export function printReportPath(baseDir: string): void {
  const colored = colorsEnabled();
  process.stdout.write(`${tone("Wrote reports to", "muted", colored)} ${tone(resolve(baseDir), "accent", colored)}\n`);
}

export function formatCliError(message: string): string {
  return `${tone("Error:", "failure", colorsEnabled(process.stderr))} ${message}`;
}

export function formatCliInfo(message: string): string {
  return tone(message, "muted", colorsEnabled(process.stderr));
}
