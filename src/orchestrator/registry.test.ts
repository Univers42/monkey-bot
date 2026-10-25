import { describe, expect, it } from "vitest";
import { getBotById, listBotDefinitions } from "./registry";

describe("bot registry", () => {
  it("registers smoke and form-xss bots", () => {
    const ids = listBotDefinitions().map((bot) => bot.id).sort();
    expect(ids).toEqual(["form-xss", "smoke"]);
    expect(getBotById("form-xss")?.id).toBe("form-xss");
    expect(getBotById("missing")).toBeUndefined();
  });
});
