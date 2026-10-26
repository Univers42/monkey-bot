import { describe, expect, it } from "vitest";
import { launchChromium } from "../../lib/chromium";
import { runFormXssBot } from "./runner";

async function chromiumAvailable(): Promise<boolean> {
  try {
    const browser = await launchChromium();
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

describe("runFormXssBot calibration (optional locally)", () => {
  it("kills XSS mutants when Chromium is available", async () => {
    if (!(await chromiumAvailable())) {
      return;
    }

    const result = await runFormXssBot({ calibrateOnly: true, timeoutMs: 20_000 });

    expect(result.probeTrusted).toBe(true);
    const byId = Object.fromEntries(result.calibrations.map((row) => [row.mutantId, row]));
    expect(byId["reflected-xss"]?.verdict).toBe("killed");
    expect(byId["attr-xss"]?.verdict).toBe("killed");
    expect(result.findings).toEqual([]);
  });
});
