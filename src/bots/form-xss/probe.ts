import type { Page } from "playwright-core";
import type { FaultClass } from "../../findings/types";
import { buildAttrXssPayload, buildXssPayload, type XssPayload } from "./payloads";

export type ProbeHit = {
  detected: boolean;
  token: string;
  payload: string;
  faultClass: FaultClass;
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

async function clearOracle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = globalThis as typeof globalThis & { __MB_XSS__?: string };
    delete g.__MB_XSS__;
  });
}

async function submitPayload(
  page: Page,
  pageUrl: string,
  selectors: ProbeSelectors,
  timeoutMs: number,
  payload: XssPayload
): Promise<ProbeHit> {
  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await clearOracle(page);
  await page.waitForSelector(selectors.formSelector, { timeout: timeoutMs });

  const field = page.locator(selectors.fieldSelector).first();
  await field.waitFor({ state: "visible", timeout: timeoutMs });
  await field.fill(payload.body);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: timeoutMs }),
    page.locator(selectors.submitSelector).first().click()
  ]);

  const detected = await oracleHit(page, payload.token);
  return {
    detected,
    token: payload.token,
    payload: payload.body,
    faultClass: payload.faultClass,
    finalUrl: page.url(),
    evidence: detected
      ? `window.__MB_XSS__ === ${JSON.stringify(payload.token)} after submit (${payload.faultClass})`
      : `oracle not set after submit for ${payload.faultClass}`
  };
}

/** Probe with the payload matching the mutant fault class. */
export async function probeFormXssForFault(
  page: Page,
  pageUrl: string,
  selectors: ProbeSelectors,
  timeoutMs: number,
  faultClass: FaultClass
): Promise<ProbeHit> {
  const payload = faultClass === "attr-xss" ? buildAttrXssPayload() : buildXssPayload();
  return submitPayload(page, pageUrl, selectors, timeoutMs, payload);
}

/**
 * Try reflected then attribute payloads; return the first hit (or last miss).
 */
export async function probeFormXss(
  page: Page,
  pageUrl: string,
  selectors: ProbeSelectors,
  timeoutMs: number
): Promise<ProbeHit> {
  const reflected = await submitPayload(page, pageUrl, selectors, timeoutMs, buildXssPayload());
  if (reflected.detected) {
    return reflected;
  }
  return submitPayload(page, pageUrl, selectors, timeoutMs, buildAttrXssPayload());
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
  return detected ? "arid-noise" : "survived";
}

/** Target findings allowed only when every must-kill mutant was killed. */
export function probeTrustedForFaultClass(
  calibrations: ReadonlyArray<{ faultClass: string; expectation: string; detected: boolean }>
): boolean {
  const killers = calibrations.filter((c) => c.expectation === "must-kill");
  if (killers.length === 0) {
    return false;
  }
  return killers.every((c) => c.detected);
}
