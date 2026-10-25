import type { Page } from "playwright-core";
import { buildXssPayload } from "./payloads";

export type ProbeHit = {
  detected: boolean;
  token: string;
  payload: string;
  finalUrl: string;
  evidence: string;
};

export type ProbeSelectors = {
  formSelector: string;
  fieldSelector: string;
  submitSelector: string;
};

export const DEFAULT_SELECTORS: ProbeSelectors = {
  formSelector: "form",
  fieldSelector: "input[type='text'], input:not([type]), textarea",
  submitSelector: "button[type='submit'], input[type='submit'], button"
};

async function oracleHit(page: Page, token: string): Promise<boolean> {
  return page.evaluate((expected) => {
    const g = globalThis as typeof globalThis & { __MB_XSS__?: string };
    return g.__MB_XSS__ === expected;
  }, token);
}

/**
 * Submit an XSS payload into the first matching form field and check the oracle.
 * Observable effect required: window.__MB_XSS__ === token (script/handler executed).
 */
export async function probeFormXss(
  page: Page,
  pageUrl: string,
  selectors: ProbeSelectors,
  timeoutMs: number
): Promise<ProbeHit> {
  const { token, body } = buildXssPayload();

  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForSelector(selectors.formSelector, { timeout: timeoutMs });

  const field = page.locator(selectors.fieldSelector).first();
  await field.waitFor({ state: "visible", timeout: timeoutMs });
  await field.fill(body);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: timeoutMs }),
    page.locator(selectors.submitSelector).first().click()
  ]);

  const detected = await oracleHit(page, token);
  return {
    detected,
    token,
    payload: body,
    finalUrl: page.url(),
    evidence: detected
      ? `window.__MB_XSS__ === ${JSON.stringify(token)} after submit`
      : "oracle not set after submit (no script execution observed)"
  };
}

export type CalibrationVerdict = "killed" | "survived" | "false-positive" | "arid-noise";

export function verdictForExpectation(
  expectation: "must-kill" | "must-survive" | "arid",
  detected: boolean
): CalibrationVerdict {
  if (expectation === "must-kill") {
    return detected ? "killed" : "survived";
  }
  if (expectation === "must-survive") {
    return detected ? "false-positive" : "survived";
  }
  // arid: detection is noise; non-detection is fine
  return detected ? "arid-noise" : "survived";
}

/** Target findings are allowed only when the matching must-kill mutant was killed. */
export function probeTrustedForFaultClass(
  calibrations: ReadonlyArray<{ faultClass: string; expectation: string; detected: boolean }>
): boolean {
  const killers = calibrations.filter((c) => c.expectation === "must-kill");
  if (killers.length === 0) {
    return false;
  }
  return killers.every((c) => c.detected);
}
