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

describe("runFormXssBot calibration", () => {
  it("kills the reflected-xss mutant and stays quiet on controls", async () => {
    if (!(await chromiumAvailable())) {
      // Host Chromium may be unavailable (e.g. snap AppArmor); unit suite still covers gates.
      return;
    }

    const result = await runFormXssBot({ calibrateOnly: true, timeoutMs: 20000 });

    expect(result.probeTrusted).toBe(true);

    const byId = Object.fromEntries(result.calibrations.map((row) => [row.mutantId, row]));
    expect(byId["reflected-xss"]?.verdict).toBe("killed");
    expect(byId["escaped-echo"]?.verdict).toBe("survived");
    expect(byId["arid-log-only"]?.verdict).not.toBe("killed");
    expect(result.findings).toEqual([]);
    expect(result.target).toBeNull();
  });
});
