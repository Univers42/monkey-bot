import { existsSync } from "node:fs";
import { resolveChromiumPath } from "../../browser.ts";
import type { DoctorCheck } from "../../core.ts";
import type { NotionLikeConfig } from "./types.ts";

export async function runDoctor(config: NotionLikeConfig): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  const chromiumPath = resolveChromiumPath();
  const browserOk = typeof chromiumPath === "string"
    ? existsSync(chromiumPath)
    : process.env.PLAYWRIGHT_DOCKER === "1";

  checks.push({
    name: "browser",
    ok: browserOk,
    details: chromiumPath
      ? browserOk
        ? `chromium at ${chromiumPath}`
        : `missing chromium at ${chromiumPath}`
      : browserOk
        ? "managed by Playwright image"
        : "no chromium path resolved; use CHROMIUM_PATH, install Playwright browsers locally, or run qa-runner in Docker"
  });

  try {
    const health = await fetch(new URL(config.routes.login, config.baseUrl), {
      method: "GET"
    });
    checks.push({
      name: "base-url",
      ok: health.status < 500,
      details: `${config.baseUrl}${config.routes.login} -> HTTP ${health.status}`
    });
  } catch (error) {
    checks.push({
      name: "base-url",
      ok: false,
      details: error instanceof Error ? error.message : "Unable to reach base URL"
    });
  }

  checks.push({
    name: "feature-flags",
    ok: true,
    details: Object.entries(config.featureFlags)
      .map(([key, value]) => `${key}=${value ? "on" : "off"}`)
      .join(", ")
  });

  checks.push({
    name: "users",
    ok: true,
    details: Object.values(config.users)
      .map((selectedUser) => `${selectedUser.key}:${selectedUser.email}`)
      .join(", ")
  });

  return checks;
}
