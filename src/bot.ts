import { chromium } from "playwright-core";
import { existsSync } from "node:fs";

export type BotRunInput = {
  url: string;
  waitForSelector?: string;
  timeoutMs?: number;
};

export type BotRunResult = {
  title: string;
  finalUrl: string;
  consoleErrors: string[];
  failedRequests: string[];
};

const DEFAULT_TIMEOUT_MS = 30_000;

function resolveChromiumPath(): string {
  if (process.env.CHROMIUM_PATH) {
    return process.env.CHROMIUM_PATH;
  }

  const candidates = ["/usr/bin/chromium-browser", "/usr/bin/chromium"];
  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }

  return "/usr/bin/chromium-browser";
}

export async function runBot(input: BotRunInput): Promise<BotRunResult> {
  const timeout = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  const browser = await chromium.launch({
    executablePath: resolveChromiumPath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
    });

    await page.goto(input.url, { waitUntil: "domcontentloaded", timeout });

    if (input.waitForSelector) {
      await page.waitForSelector(input.waitForSelector, { timeout });
    }

    const title = await page.title();
    const finalUrl = page.url();

    await context.close();

    return {
      title,
      finalUrl,
      consoleErrors,
      failedRequests
    };
  } finally {
    await browser.close();
  }
}