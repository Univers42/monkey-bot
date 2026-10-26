import { writeArtifact } from "../../lib/artifacts";
import { openAuthenticatedContext, type TargetAuthConfig } from "../../lib/auth";
import { launchChromium } from "../../lib/chromium";
import type { SecurityFinding } from "../../findings/types";
import { MUTANT_FIXTURES, fixtureFileUrl, type MutantFixture } from "../../mutants/catalog";
import {
  DEFAULT_SELECTORS,
  probeFormXss,
  probeFormXssForFault,
  probeTrustedForFaultClass,
  verdictForExpectation,
  type CalibrationVerdict,
  type ProbeHit,
  type ProbeSelectors
} from "./probe";
import type { FormXssBotInput } from "./schema";

const DEFAULT_TIMEOUT_MS = 30_000;

export type MutantCalibrationRow = {
  mutantId: string;
  faultClass: string;
  expectation: MutantFixture["expectation"];
  detected: boolean;
  verdict: CalibrationVerdict;
  evidence: string;
  finalUrl: string;
  payload: string;
};

export type FormXssBotResult = {
  botId: "form-xss";
  targetId?: string;
  probeTrusted: boolean;
  calibrations: MutantCalibrationRow[];
  target: ProbeHit | null;
  findings: SecurityFinding[];
  suppressed: string[];
  artifactPath?: string;
};

function resolveSelectors(input: FormXssBotInput): ProbeSelectors {
  return {
    formSelector: input.formSelector ?? DEFAULT_SELECTORS.formSelector,
    fieldSelector: input.fieldSelector ?? DEFAULT_SELECTORS.fieldSelector,
    submitSelector: input.submitSelector ?? DEFAULT_SELECTORS.submitSelector
  };
}

export async function runFormXssBot(input: FormXssBotInput): Promise<FormXssBotResult> {
  const timeout = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const selectors = resolveSelectors(input);
  const browser = await launchChromium();
  const suppressed: string[] = [];
  const auth = input.auth as TargetAuthConfig | undefined;

  try {
    const { context } = await openAuthenticatedContext(browser, auth);
    const page = await context.newPage();

    const calibrations: MutantCalibrationRow[] = [];
    for (const mutant of MUTANT_FIXTURES) {
      const hit = await probeFormXssForFault(
        page,
        fixtureFileUrl(mutant.fileName),
        DEFAULT_SELECTORS,
        timeout,
        mutant.faultClass
      );
      const verdict = verdictForExpectation(mutant.expectation, hit.detected);
      calibrations.push({
        mutantId: mutant.id,
        faultClass: mutant.faultClass,
        expectation: mutant.expectation,
        detected: hit.detected,
        verdict,
        evidence: hit.evidence,
        finalUrl: hit.finalUrl,
        payload: hit.payload
      });

      if (verdict === "arid-noise") {
        suppressed.push(`arid mutant ${mutant.id}: noise is not a finding`);
      }
      if (verdict === "false-positive") {
        suppressed.push(
          `control ${mutant.id}: probe fired on a safe sink — treat subsequent target hits as untrusted`
        );
      }
    }

    const falsePositiveControl = calibrations.some((c) => c.verdict === "false-positive");
    const probeTrusted = !falsePositiveControl && probeTrustedForFaultClass(calibrations);

    if (!probeTrusted) {
      suppressed.push(
        "probe not trusted: must-kill mutant survived or negative control fired (UNKNOWN = FAIL)"
      );
    }

    let target: ProbeHit | null = null;
    const findings: SecurityFinding[] = [];

    if (!input.calibrateOnly && input.url) {
      target = await probeFormXss(page, input.url, selectors, timeout);

      if (target.detected && probeTrusted) {
        findings.push({
          faultClass: target.faultClass,
          targetId: input.targetId,
          severity: "high",
          evidence: {
            payload: target.payload,
            effect: target.evidence,
            finalUrl: target.finalUrl,
            sink: "form-field"
          }
        });
      } else if (target.detected && !probeTrusted) {
        suppressed.push(
          "target oracle fired but finding suppressed: probe failed mutant calibration"
        );
      } else if (!target.detected) {
        suppressed.push("target: no XSS oracle hit (not reported)");
      }
    }

    await context.close();

    const result: FormXssBotResult = {
      botId: "form-xss",
      targetId: input.targetId,
      probeTrusted,
      calibrations,
      target,
      findings,
      suppressed
    };

    if (input.writeArtifact) {
      result.artifactPath = writeArtifact(`form-xss-${input.targetId ?? "calibrate"}`, result);
    }

    return result;
  } finally {
    await browser.close();
  }
}
