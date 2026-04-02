import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import type { LoginBotInput } from "./schema";

export type LoginBotResult = {
  title: string;
  finalUrl: string;
  attemptedLogin: boolean;
  loginSucceeded: boolean | null;
  notes: string[];
  consoleErrors: string[];
  failedRequests: string[];
};

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_USERNAME_SELECTOR = "input[name='username'], input[type='email']";
const DEFAULT_PASSWORD_SELECTOR = "input[name='password'], input[type='password']";
const DEFAULT_SUBMIT_SELECTOR = "button[type='submit'], input[type='submit']";

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

export async function runLoginBot(input: LoginBotInput): Promise<LoginBotResult> {
  const timeout = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const notes: string[] = [];

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

    let attemptedLogin = false;
    let loginSucceeded: boolean | null = null;

    if (input.username !== undefined && input.password !== undefined) {
      attemptedLogin = true;

      const usernameSelector = input.usernameSelector ?? DEFAULT_USERNAME_SELECTOR;
      const passwordSelector = input.passwordSelector ?? DEFAULT_PASSWORD_SELECTOR;
      const submitSelector = input.submitSelector ?? DEFAULT_SUBMIT_SELECTOR;

      try {
        await page.locator(usernameSelector).first().fill(input.username, { timeout });
        await page.locator(passwordSelector).first().fill(input.password, { timeout });
        await page.locator(submitSelector).first().click({ timeout });

        if (input.successSelector) {
          await page.waitForSelector(input.successSelector, { timeout });
          loginSucceeded = true;
          notes.push("Success selector found after form submission.");
        } else {
          notes.push("Credentials submitted, but no successSelector provided to validate login outcome.");
        }
      } catch (error) {
        loginSucceeded = false;
        const errorMessage = error instanceof Error ? error.message : "Unknown login interaction error";
        notes.push(`Login flow interaction failed: ${errorMessage}`);
      }
    } else {
      notes.push("Login attempt skipped because username/password were not provided.");
      notes.push("Use this scaffold to validate page readiness until login flow is implemented.");
    }

    const title = await page.title();
    const finalUrl = page.url();

    await context.close();

    return {
      title,
      finalUrl,
      attemptedLogin,
      loginSucceeded,
      notes,
      consoleErrors,
      failedRequests
    };
  } finally {
    await browser.close();
  }
}
