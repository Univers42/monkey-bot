import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MUTANT_FIXTURES, fixtureFileUrl } from "./catalog";

describe("mutant catalog", () => {
  it("includes reflected and attribute XSS expectations", () => {
    const ids = MUTANT_FIXTURES.map((m) => m.id);
    expect(ids).toContain("reflected-xss");
    expect(ids).toContain("escaped-echo");
    expect(ids).toContain("arid-log-only");
    expect(ids).toContain("attr-xss");
    expect(ids).toContain("attr-escaped");

    const mustKill = MUTANT_FIXTURES.filter((m) => m.expectation === "must-kill").map((m) => m.id);
    expect(mustKill).toEqual(["reflected-xss", "attr-xss"]);
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
