import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BotInputValidationError } from "../../orchestrator/errors";
import { parseFormXssBotInput } from "./schema";

const previousTargetsFile = process.env.MONKEY_BOT_TARGETS_FILE;

afterEach(() => {
  if (previousTargetsFile === undefined) {
    delete process.env.MONKEY_BOT_TARGETS_FILE;
  } else {
    process.env.MONKEY_BOT_TARGETS_FILE = previousTargetsFile;
  }
});

function writeTargets(contents: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "monkey-bot-form-xss-"));
  const path = join(dir, "targets.json");
  writeFileSync(path, JSON.stringify(contents));
  process.env.MONKEY_BOT_TARGETS_FILE = path;
  return path;
}

describe("parseFormXssBotInput", () => {
  it("allows calibrateOnly without a url", () => {
    expect(parseFormXssBotInput({ calibrateOnly: true })).toEqual({
      url: undefined,
      targetId: undefined,
      formSelector: undefined,
      fieldSelector: undefined,
      submitSelector: undefined,
      timeoutMs: undefined,
      calibrateOnly: true,
      writeArtifact: undefined,
      auth: undefined
    });
  });

  it("requires url or targetId when not calibrating", () => {
    expect(() => parseFormXssBotInput({})).toThrow(BotInputValidationError);
  });

  it("resolves targetId into url and selectors", () => {
    writeTargets({
      defaults: { timeoutMs: 15000 },
      targets: {
        "search-form": {
          url: "http://localhost:9999/search",
          formSelector: "#search",
          fieldSelector: "input[name=q]",
          submitSelector: "button.go",
          timeoutMs: 12000
        }
      }
    });

    expect(parseFormXssBotInput({ targetId: "search-form" })).toMatchObject({
      targetId: "search-form",
      url: "http://localhost:9999/search",
      formSelector: "#search",
      fieldSelector: "input[name=q]",
      submitSelector: "button.go",
      timeoutMs: 12000
    });
  });

  it("lets request fields override the named target", () => {
    writeTargets({
      targets: {
        "search-form": {
          url: "http://localhost:9999/search",
          formSelector: "#search",
          fieldSelector: "input[name=q]"
        }
      }
    });

    expect(
      parseFormXssBotInput({
        targetId: "search-form",
        url: "http://override.example/",
        fieldSelector: "#override",
        timeoutMs: 5000
      })
    ).toMatchObject({
      url: "http://override.example/",
      formSelector: "#search",
      fieldSelector: "#override",
      timeoutMs: 5000
    });
  });
});
