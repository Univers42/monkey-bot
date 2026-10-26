import { describe, expect, it } from "vitest";
import { BotInputValidationError } from "../orchestrator/errors";
import { performLogin, type TargetAuthConfig } from "./auth";

describe("auth helpers", () => {
  it("requires username/password env vars before login", async () => {
    delete process.env.MONKEY_BOT_TEST_USER;
    delete process.env.MONKEY_BOT_TEST_PASS;

    const auth: TargetAuthConfig = {
      loginUrl: "file:///tmp/unused.html",
      usernameSelector: "#user",
      passwordSelector: "#pass",
      submitSelector: "button",
      usernameEnv: "MONKEY_BOT_TEST_USER",
      passwordEnv: "MONKEY_BOT_TEST_PASS"
    };

    await expect(
      performLogin(
        {
          goto: async () => undefined,
          waitForSelector: async () => undefined,
          fill: async () => undefined,
          locator: () => ({ first: () => ({ click: async () => undefined }) }),
          waitForNavigation: async () => undefined
        } as never,
        auth
      )
    ).rejects.toBeInstanceOf(BotInputValidationError);
  });
});
