import type { Browser, BrowserContext, Page } from "playwright-core";
import { existsSync } from "node:fs";
import { BotInputValidationError } from "../orchestrator/errors";

export type TargetAuthConfig = {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  /** Env var holding username (never commit secrets). */
  usernameEnv: string;
  /** Env var holding password (never commit secrets). */
  passwordEnv: string;
  /** Optional path to Playwright storageState JSON. */
  storageStatePath?: string;
  timeoutMs?: number;
};

export type AuthSessionResult = {
  usedStorageState: boolean;
  loggedIn: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new BotInputValidationError(
      `Auth requires env var ${name} to be set (see target auth.usernameEnv / passwordEnv)`
    );
  }
  return value;
}

/** Open a context, optionally restoring storage state or performing a form login. */
export async function openAuthenticatedContext(
  browser: Browser,
  auth?: TargetAuthConfig
): Promise<{ context: BrowserContext; session: AuthSessionResult }> {
  if (!auth) {
    const context = await browser.newContext();
    return { context, session: { usedStorageState: false, loggedIn: false } };
  }

  if (auth.storageStatePath && existsSync(auth.storageStatePath)) {
    const context = await browser.newContext({ storageState: auth.storageStatePath });
    return { context, session: { usedStorageState: true, loggedIn: true } };
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  await performLogin(page, auth);
  await page.close();
  return { context, session: { usedStorageState: false, loggedIn: true } };
}

export async function performLogin(page: Page, auth: TargetAuthConfig): Promise<void> {
  const timeout = auth.timeoutMs ?? 20_000;
  const username = requireEnv(auth.usernameEnv);
  const password = requireEnv(auth.passwordEnv);

  await page.goto(auth.loginUrl, { waitUntil: "domcontentloaded", timeout });
  await page.waitForSelector(auth.usernameSelector, { timeout });
  await page.fill(auth.usernameSelector, username);
  await page.fill(auth.passwordSelector, password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout }).catch(() => undefined),
    page.locator(auth.submitSelector).first().click()
  ]);
}
