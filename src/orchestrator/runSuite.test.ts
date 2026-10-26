import { describe, expect, it } from "vitest";
import { BotInputValidationError } from "./errors";
import { parseSuiteInput } from "./runSuite";

describe("parseSuiteInput", () => {
  it("accepts calibrateOnly without a target", () => {
    expect(parseSuiteInput({ calibrateOnly: true, botIds: ["form-xss"] })).toMatchObject({
      calibrateOnly: true,
      botIds: ["form-xss"]
    });
  });

  it("requires targetId or url when not calibrating", () => {
    expect(() => parseSuiteInput({})).toThrow(BotInputValidationError);
  });

  it("accepts targetId for suite runs", () => {
    expect(parseSuiteInput({ targetId: "mutant-lab-reflected-xss" })).toMatchObject({
      targetId: "mutant-lab-reflected-xss"
    });
  });
});
