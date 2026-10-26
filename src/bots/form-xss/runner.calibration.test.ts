import { describe, expect, it } from "vitest";
import { runFormXssBot } from "./runner";

/**
 * Hard gate: Chromium must be available and mutants must be killed.
 * Run via `pnpm test:calibration` (CI). Soft unit suite stays separate.
 */
describe("form-xss mutant calibration (required)", () => {
  it("kills must-kill mutants and stays quiet on controls", async () => {
    const result = await runFormXssBot({ calibrateOnly: true, timeoutMs: 30_000 });

    expect(result.probeTrusted).toBe(true);

    const byId = Object.fromEntries(result.calibrations.map((row) => [row.mutantId, row]));
    expect(byId["reflected-xss"]?.verdict).toBe("killed");
    expect(byId["escaped-echo"]?.verdict).toBe("survived");
    expect(byId["arid-log-only"]?.verdict).toBe("survived");
    expect(byId["attr-xss"]?.verdict).toBe("killed");
    expect(byId["attr-escaped"]?.verdict).toBe("survived");
    expect(result.findings).toEqual([]);
    expect(result.target).toBeNull();
  }, 90_000);
});
