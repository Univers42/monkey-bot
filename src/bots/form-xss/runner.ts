import { MUTANT_FIXTURES, fixtureFileUrl, type MutantFixture } from "../../mutants/catalog";
import { launchChromium } from "../../lib/chromium";
import {
  DEFAULT_SELECTORS,
  probeFormXss,
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

export type FormXssFinding = {
  faultClass: "reflected-xss";
  payload: string;
  evidence: string;
  finalUrl: string;
};

export type FormXssBotResult = {
  probeTrusted: boolean;
  calibrations: MutantCalibrationRow[];
  target: ProbeHit | null;
  findings: FormXssFinding[];
  suppressed: string[];
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

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const calibrations: MutantCalibrationRow[] = [];
    for (const mutant of MUTANT_FIXTURES) {
      const hit = await probeFormXss(page, fixtureFileUrl(mutant.fileName), DEFAULT_SELECTORS, timeout);
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
        suppressed.push(`arid mutant ${mutant.id}: console-only noise is not a finding`);
      }
      if (verdict === "false-positive") {
        suppressed.push(
          `control ${mutant.id}: probe fired on a safe sink — treat subsequent target hits as untrusted`
        );
      }
    }

    const falsePositiveControl = calibrations.some((c) => c.verdict === "false-positive");
    const probeTrusted =
      !falsePositiveControl && probeTrustedForFaultClass(calibrations);

    if (!probeTrusted) {
      suppressed.push(
        "probe not trusted: must-kill mutant survived or negative control fired (UNKNOWN = FAIL)"
      );
    }

    let target: ProbeHit | null = null;
    const findings: FormXssFinding[] = [];

    if (!input.calibrateOnly && input.url) {
      target = await probeFormXss(page, input.url, selectors, timeout);

      if (target.detected && probeTrusted) {
        findings.push({
          faultClass: "reflected-xss",
          payload: target.payload,
          evidence: target.evidence,
          finalUrl: target.finalUrl
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

    return {
      probeTrusted,
      calibrations,
      target,
      findings,
      suppressed
    };
  } finally {
    await browser.close();
  }
}
