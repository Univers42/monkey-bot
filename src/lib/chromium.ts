import { existsSync } from "node:fs";
import { chromium, type Browser } from "playwright-core";

export function resolveChromiumPath(): string {
  if (process.env.CHROMIUM_PATH) {
    return process.env.CHROMIUM_PATH;
  }

  const candidates = [
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium"
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }

  return "/usr/bin/chromium-browser";
}

export async function launchChromium(): Promise<Browser> {
  return chromium.launch({
    executablePath: resolveChromiumPath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
}
