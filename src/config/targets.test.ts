import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { BotInputValidationError } from "../orchestrator/errors";
import { listTargetSummaries, loadTargetsFile, resolveTarget } from "./targets";

const previousTargetsFile = process.env.MONKEY_BOT_TARGETS_FILE;

afterEach(() => {
  if (previousTargetsFile === undefined) {
    delete process.env.MONKEY_BOT_TARGETS_FILE;
  } else {
    process.env.MONKEY_BOT_TARGETS_FILE = previousTargetsFile;
  }
});

function writeTargets(contents: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "monkey-bot-targets-"));
  const path = join(dir, "targets.json");
  writeFileSync(path, JSON.stringify(contents));
  process.env.MONKEY_BOT_TARGETS_FILE = path;
  return path;
}

describe("targets config", () => {
  it("loads targets and resolves defaults.timeoutMs", () => {
    writeTargets({
      defaults: { timeoutMs: 15000 },
      targets: {
        alpha: {
          url: "http://localhost:1/",
          description: "Alpha"
        }
      }
    });

    const file = loadTargetsFile();
    expect(file.targets.alpha.url).toBe("http://localhost:1/");
    expect(resolveTarget("alpha")).toMatchObject({
      id: "alpha",
      url: "http://localhost:1/",
      timeoutMs: 15000
    });
    expect(listTargetSummaries()).toEqual([
      { id: "alpha", url: "http://localhost:1/", description: "Alpha" }
    ]);
  });

  it("rejects unknown target ids with known names", () => {
    writeTargets({
      targets: {
        alpha: { url: "http://localhost:1/" }
      }
    });

    expect(() => resolveTarget("missing")).toThrow(/Unknown targetId "missing"/);
    expect(() => resolveTarget("missing")).toThrow(/alpha/);
  });

  it("rejects invalid target entries", () => {
    writeTargets({
      targets: {
        broken: { description: "no url" }
      }
    });

    expect(() => loadTargetsFile()).toThrow(BotInputValidationError);
  });

  it("loads the committed repo targets.json when env is unset", () => {
    delete process.env.MONKEY_BOT_TARGETS_FILE;
    const summaries = listTargetSummaries();
    expect(summaries.some((t) => t.id === "local-app")).toBe(true);
  });
});
