import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/bots/form-xss/runner", () => ({
  runFormXssBot: vi.fn(async (input: { calibrateOnly?: boolean; targetId?: string }) => ({
    botId: "form-xss",
    targetId: input.targetId,
    probeTrusted: true,
    calibrations: [
      {
        mutantId: "reflected-xss",
        faultClass: "reflected-xss",
        expectation: "must-kill",
        detected: true,
        verdict: "killed",
        evidence: "ok",
        finalUrl: "file://mutant",
        payload: "x"
      }
    ],
    target: input.calibrateOnly
      ? null
      : {
          detected: false,
          token: "t",
          payload: "p",
          faultClass: "reflected-xss",
          finalUrl: "https://prismatica-eta.vercel.app/?lang=en",
          evidence: "no hit"
        },
    findings: [],
    suppressed: ["target: no XSS oracle hit (not reported)"],
    artifactPath: undefined
  }))
}));

vi.mock("../src/lib/artifacts", () => ({
  writeArtifact: vi.fn(() => "/tmp/artifact.json")
}));

describe("mcp tools", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calibrateMutants reports trusted when runner is trusted", async () => {
    const { calibrateMutants } = await import("./tools");
    const result = await calibrateMutants(1000);
    expect(result.ok).toBe(true);
    expect(result.summary).toMatch(/trusted/i);
  });

  it("listConfiguredTargets returns targets and bots", async () => {
    const { listConfiguredTargets } = await import("./tools");
    const result = listConfiguredTargets();
    expect(result.ok).toBe(true);
    const data = result.data as { targets: Array<{ id: string }>; bots: unknown[] };
    expect(Array.isArray(data.targets)).toBe(true);
    expect(Array.isArray(data.bots)).toBe(true);
  });

  it("checkSecurityHeaders records observations without inventing findings", async () => {
    const { checkSecurityHeaders } = await import("./tools");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        url: "https://prismatica-eta.vercel.app/?lang=en",
        headers: {
          get: (name: string) => {
            if (name === "content-security-policy") return "frame-ancestors 'none'";
            if (name === "x-frame-options") return "DENY";
            if (name === "x-content-type-options") return "nosniff";
            return null;
          }
        }
      }))
    );

    const result = await checkSecurityHeaders("https://prismatica-eta.vercel.app/?lang=en");
    expect(result.ok).toBe(true);
    const data = result.data as { findings: unknown[]; observations: string[] };
    expect(data.findings).toEqual([]);
    expect(data.observations.length).toBeGreaterThan(0);
  });
});
