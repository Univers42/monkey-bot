import type { SmokeBotInput } from "./schema";
import { launchChromium } from "../../lib/chromium";

export type SmokeBotResult = {
  title: string;
  finalUrl: string;
  consoleErrors: string[];
  failedRequests: string[];
};

const DEFAULT_TIMEOUT_MS = 30_000;

export async function runSmokeBot(input: SmokeBotInput): Promise<SmokeBotResult> {
  const timeout = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  const browser = await launchChromium();

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
