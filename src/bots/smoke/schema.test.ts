import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BotInputValidationError } from "../../orchestrator/errors";
import { parseSmokeBotInput } from "./schema";

const previousTargetsFile = process.env.MONKEY_BOT_TARGETS_FILE;

afterEach(() => {
  if (previousTargetsFile === undefined) {
    delete process.env.MONKEY_BOT_TARGETS_FILE;
  } else {
    process.env.MONKEY_BOT_TARGETS_FILE = previousTargetsFile;
  }
});

function writeTargets(contents: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "monkey-bot-smoke-"));
  const path = join(dir, "targets.json");
  writeFileSync(path, JSON.stringify(contents));
  process.env.MONKEY_BOT_TARGETS_FILE = path;
  return path;
}

describe("parseSmokeBotInput", () => {
  it("accepts an explicit url", () => {
    expect(parseSmokeBotInput({ url: "https://example.com", timeoutMs: 1000 })).toEqual({
      url: "https://example.com",
      targetId: undefined,
      waitForSelector: undefined,
      timeoutMs: 1000
    });
  });

  it("rejects bodies without url or targetId", () => {
    expect(() => parseSmokeBotInput({})).toThrow(BotInputValidationError);
  });

  it("resolves targetId into url and waitForSelector", () => {
    writeTargets({
      targets: {
        "local-app": {
          url: "http://localhost:5173/",
          waitForSelector: "form",
          timeoutMs: 20000
        }
      }
    });

    expect(parseSmokeBotInput({ targetId: "local-app" })).toMatchObject({
      targetId: "local-app",
      url: "http://localhost:5173/",
      waitForSelector: "form",
      timeoutMs: 20000
    });
  });
});
