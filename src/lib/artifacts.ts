import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ARTIFACTS_DIR = join(process.cwd(), "artifacts");

/** Persist a bot/suite report under ./artifacts (gitignored). */
export function writeArtifact(name: string, payload: unknown): string {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = join(ARTIFACTS_DIR, `${safe}-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
  return path;
}
