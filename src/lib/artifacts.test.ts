import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeArtifact } from "./artifacts";

const artifactsDir = join(process.cwd(), "artifacts");

afterEach(() => {
  rmSync(artifactsDir, { recursive: true, force: true });
});

describe("writeArtifact", () => {
  it("writes JSON under ./artifacts", () => {
    const path = writeArtifact("unit-test", { ok: true, n: 1 });
    expect(path.startsWith(artifactsDir)).toBe(true);
    expect(existsSync(path)).toBe(true);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ ok: true, n: 1 });
  });
});
