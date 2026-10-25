import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MUTANT_FIXTURES, fixtureFileUrl } from "./catalog";

describe("mutant catalog", () => {
  it("includes must-kill, must-survive, and arid expectations", () => {
    const byExpectation = Object.fromEntries(
      MUTANT_FIXTURES.map((m) => [m.expectation, m.id])
    );

    expect(byExpectation["must-kill"]).toBe("reflected-xss");
    expect(byExpectation["must-survive"]).toBe("escaped-echo");
    expect(byExpectation.arid).toBe("arid-log-only");
  });

  it("points every fixture file at an existing HTML file", () => {
    for (const mutant of MUTANT_FIXTURES) {
      const url = fixtureFileUrl(mutant.fileName);
      expect(url.startsWith("file:")).toBe(true);
      const path = fileURLToPath(url);
      expect(existsSync(path), `${mutant.id} missing at ${path}`).toBe(true);
    }
  });
});

