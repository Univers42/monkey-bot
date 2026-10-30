import { writeArtifact } from "../src/lib/artifacts";
import { listTargetSummaries, resolveTarget } from "../src/config/targets";
import { parseFormXssBotInput } from "../src/bots/form-xss/schema";
import { runFormXssBot } from "../src/bots/form-xss/runner";
import { listBots } from "../src/orchestrator/runBot";

export const PRISMATICA_BASE = "https://prismatica-eta.vercel.app/?lang=en";

const PRISMATICA_TARGET_PREFIX = "prismatica-";

export type JsonResult = {
  ok: boolean;
  summary: string;
  data: unknown;
};

function ok(summary: string, data: unknown): JsonResult {
  return { ok: true, summary, data };
}

function fail(summary: string, data: unknown = {}): JsonResult {
  return { ok: false, summary, data };
}

export async function calibrateMutants(timeoutMs = 45_000): Promise<JsonResult> {
  const result = await runFormXssBot({
    calibrateOnly: true,
    writeArtifact: true,
    timeoutMs
  });
  const summary = result.probeTrusted
    ? "Mutant calibration trusted — probes may report target findings"
    : "Mutant calibration FAILED — target findings must be suppressed (UNKNOWN = FAIL)";
  return {
    ok: result.probeTrusted,
    summary,
    data: {
      probeTrusted: result.probeTrusted,
      calibrations: result.calibrations,
      suppressed: result.suppressed,
      artifactPath: result.artifactPath
    }
  };
}

export function listConfiguredTargets(): JsonResult {
  const targets = listTargetSummaries();
  return ok(`Loaded ${targets.length} target(s)`, { targets, bots: listBots() });
}

export async function probeFormXss(args: {
  targetId?: string;
  url?: string;
  formSelector?: string;
  fieldSelector?: string;
  submitSelector?: string;
  timeoutMs?: number;
  writeArtifact?: boolean;
}): Promise<JsonResult> {
  const input = parseFormXssBotInput({
    targetId: args.targetId,
    url: args.url,
    formSelector: args.formSelector,
    fieldSelector: args.fieldSelector,
    submitSelector: args.submitSelector,
    timeoutMs: args.timeoutMs ?? 45_000,
    writeArtifact: args.writeArtifact ?? true
  });
  const result = await runFormXssBot(input);
  const findingCount = result.findings.length;
  const summary = !result.probeTrusted
    ? "Probe ran but is untrusted (mutants not killed) — findings suppressed"
    : findingCount > 0
      ? `Reported ${findingCount} finding(s)`
      : "No XSS findings (oracle did not fire)";
  return {
    ok: result.probeTrusted,
    summary,
    data: {
      targetId: result.targetId,
      probeTrusted: result.probeTrusted,
      findings: result.findings,
      suppressed: result.suppressed,
      target: result.target,
      calibrations: result.calibrations.map((c) => ({
        mutantId: c.mutantId,
        verdict: c.verdict,
        detected: c.detected
      })),
      artifactPath: result.artifactPath
    }
  };
}

export async function checkSecurityHeaders(url: string): Promise<JsonResult> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": "monkey-bot-mcp/1.0" }
  });
  const interesting = [
    "content-security-policy",
    "content-security-policy-report-only",
    "strict-transport-security",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "cross-origin-opener-policy",
    "cross-origin-resource-policy",
    "cross-origin-embedder-policy"
  ] as const;
  const headers: Record<string, string | null> = {};
  for (const name of interesting) {
    headers[name] = response.headers.get(name);
  }

  const observations: string[] = [];
  if (!headers["content-security-policy"] || headers["content-security-policy"] === "frame-ancestors 'none'") {
    observations.push(
      "CSP is missing or only frame-ancestors — not a finding by itself; needs an exploit path"
    );
  }
  if (!headers["strict-transport-security"]) {
    observations.push("HSTS header not present on this response (may still be set elsewhere)");
  }
  if (!headers["x-content-type-options"]) {
    observations.push("Missing X-Content-Type-Options");
  }

  return ok(`Fetched security headers for ${url} (HTTP ${response.status})`, {
    url: response.url,
    status: response.status,
    headers,
    observations,
    findings: [] as unknown[]
  });
}

/** Calibrate, then probe every configured prismatica-* target; also check headers. */
export async function scanPrismatica(args?: {
  timeoutMs?: number;
  includeHeaders?: boolean;
}): Promise<JsonResult> {
  const timeoutMs = args?.timeoutMs ?? 45_000;
  const includeHeaders = args?.includeHeaders ?? true;

  const calibration = await calibrateMutants(timeoutMs);
  if (!calibration.ok) {
    return fail("Aborted Prismatica scan: mutant calibration not trusted", { calibration });
  }

  const allTargets = listTargetSummaries();
  const prismaticaTargets = allTargets.filter((t) => t.id.startsWith(PRISMATICA_TARGET_PREFIX));
  if (prismaticaTargets.length === 0) {
    // Fall back to direct URL probe of the home page newsletter surface
    const direct = await probeFormXss({
      url: PRISMATICA_BASE,
      formSelector: "form[action*='newsletter'], form",
      fieldSelector: "#footer-newsletter-email, input[type='email'], input[type='text']",
      submitSelector: "button[type='submit'], button",
      timeoutMs,
      writeArtifact: true
    });
    const headers = includeHeaders ? await checkSecurityHeaders(PRISMATICA_BASE) : null;
    const artifactPath = writeArtifact("prismatica-mcp-scan", { calibration, direct, headers });
    return ok("Prismatica scan complete (no prismatica-* targets; used home URL)", {
      calibration,
      probes: [direct],
      headers,
      artifactPath
    });
  }

  const probes = [];
  for (const target of prismaticaTargets) {
    // Resolve to ensure mutant:/auth config is valid before probing
    resolveTarget(target.id);
    probes.push(await probeFormXss({ targetId: target.id, timeoutMs, writeArtifact: true }));
  }

  const headers = includeHeaders ? await checkSecurityHeaders(PRISMATICA_BASE) : null;
  const findingTotal = probes.reduce(
    (n, p) => n + ((p.data as { findings?: unknown[] }).findings?.length ?? 0),
    0
  );
  const artifactPath = writeArtifact("prismatica-mcp-scan", {
    calibration,
    probes,
    headers,
    findingTotal
  });

  return ok(
    `Prismatica scan complete: ${probes.length} probe(s), ${findingTotal} finding(s)`,
    { calibration, probes, headers, findingTotal, artifactPath }
  );
}
