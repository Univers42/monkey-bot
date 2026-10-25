import { describe, expect, it } from "vitest";
import { probeTrustedForFaultClass, verdictForExpectation } from "./probe";

describe("verdictForExpectation", () => {
  it("marks must-kill mutants killed or surviving", () => {
    expect(verdictForExpectation("must-kill", true)).toBe("killed");
    expect(verdictForExpectation("must-kill", false)).toBe("survived");
  });

  it("treats hits on must-survive controls as false positives", () => {
    expect(verdictForExpectation("must-survive", true)).toBe("false-positive");
    expect(verdictForExpectation("must-survive", false)).toBe("survived");
  });

  it("labels arid detections as noise", () => {
    expect(verdictForExpectation("arid", true)).toBe("arid-noise");
    expect(verdictForExpectation("arid", false)).toBe("survived");
  });
});

describe("probeTrustedForFaultClass", () => {
  it("requires every must-kill mutant to be detected", () => {
    expect(
      probeTrustedForFaultClass([
        { faultClass: "reflected-xss", expectation: "must-kill", detected: true },
        { faultClass: "reflected-xss", expectation: "must-survive", detected: false }
      ])
    ).toBe(true);

    expect(
      probeTrustedForFaultClass([
        { faultClass: "reflected-xss", expectation: "must-kill", detected: false }
      ])
    ).toBe(false);
  });

  it("is untrusted when no must-kill calibrations exist", () => {
    expect(
      probeTrustedForFaultClass([
        { faultClass: "reflected-xss", expectation: "arid", detected: false }
      ])
    ).toBe(false);
  });
});
