import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { FaultClass } from "../findings/types";

export type MutantExpectation = "must-kill" | "must-survive" | "arid";

export type MutantFixture = {
  id: string;
  faultClass: FaultClass;
  fileName: string;
  expectation: MutantExpectation;
  description: string;
};

/** Seeded fixtures used to calibrate probes (Google mutants discipline). */
export const MUTANT_FIXTURES: readonly MutantFixture[] = [
  {
    id: "reflected-xss",
    faultClass: "reflected-xss",
    fileName: "reflected-xss.html",
    expectation: "must-kill",
    description: "Unsanitized innerHTML reflection of form/query input"
  },
  {
    id: "escaped-echo",
    faultClass: "reflected-xss",
    fileName: "escaped-echo.html",
    expectation: "must-survive",
    description: "Negative control: textContent echo must not look like XSS"
  },
  {
    id: "arid-log-only",
    faultClass: "reflected-xss",
    fileName: "arid-log-only.html",
    expectation: "arid",
    description: "Arid mutant: console.log only — suppress as a finding signal"
  },
  {
    id: "attr-xss",
    faultClass: "attr-xss",
    fileName: "attr-xss.html",
    expectation: "must-kill",
    description: "Unsanitized reflection into an HTML attribute value"
  },
  {
    id: "attr-escaped",
    faultClass: "attr-xss",
    fileName: "attr-escaped.html",
    expectation: "must-survive",
    description: "Negative control: attribute value is HTML-escaped"
  }
] as const;

export function fixtureFileUrl(fileName: string): string {
  const absolute = join(process.cwd(), "src/mutants/fixtures", fileName);
  return pathToFileURL(absolute).href;
}

export function fixturesDir(): string {
  return join(process.cwd(), "src/mutants/fixtures");
}
