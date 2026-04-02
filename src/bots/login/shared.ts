import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  ConsoleMessage,
  Page,
  Request,
  Response
} from "playwright-core";
import { chromium } from "playwright-core";
import type { LoginCredential, LoginSuiteInput } from "./schema";

export type LoginScenarioStatus = "passed" | "failed" | "skipped";

export type LoginStorageSummary = {
  origin: string;
  localStorageKeys: string[];
  sessionStorageKeys: string[];
};

export type LoginCookieSummary = {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  expires: number;
  valueLength: number;
};

export type LoginSessionSnapshot = {
  cookieNames: string[];
  cookies: LoginCookieSummary[];
  storage: LoginStorageSummary[];
};

export type LoginHttpObservation = {
  url: string;
  method: string;
  status: number;
  bodyPreview?: string;
};

export type MonitoredSession = {
  label: string;
  context: BrowserContext;
  page: Page;
  consoleErrors: string[];
  failedRequests: string[];
  httpObservations: LoginHttpObservation[];
  tracePath?: string;
};

export type LoginWebSocketProbeResult = {
  opened: boolean;
  closed: boolean;
  closeCode: number | null;
  messages: string[];
  error: string | null;
};

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_API_FAILURE_STATUSES = [400, 401, 403, 404, 409, 422, 429];
export const DEFAULT_API_SUCCESS_STATUSES = [200, 201, 202, 204, 302, 303];
export const DEFAULT_SELECTORS = {
  form: "form",
  username:
    "input[name='username'], input[name='email'], input[type='email'], input[autocomplete='username'], input[type='text']",
  password: "input[name='password'], input[type='password'], input[autocomplete='current-password']",
  submit: "button[type='submit'], input[type='submit']",
  success: "[data-test='dashboard'], [data-testid='dashboard'], #dashboard:not([hidden]), [data-auth='authenticated']",
  authState:
    "[data-test='dashboard'], [data-testid='authenticated'], #dashboard:not([hidden]), [data-auth='authenticated']",
  error:
    "[role='alert']:not([hidden]), [aria-live='assertive']:not([hidden]), .error:not([hidden]), .form-error:not([hidden])",
  logout:
    "button[data-test='logout'], button[data-testid='logout'], button#logout, a[href*='logout'], button:has-text('Logout'), button:has-text('Sign out')",
  rememberMe: "input[name='remember'], input[name='rememberMe'], input[type='checkbox'][value='remember-me']",
  loading: "[aria-busy='true'], [data-loading='true'], .loading, .spinner"
} as const;

export type ResolvedLoginSelectors = {
  [TKey in keyof typeof DEFAULT_SELECTORS]: string;
};

export class ScenarioAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioAssertionError";
  }
}

export class ScenarioSkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioSkipError";
  }
}

type ArtifactOptions = {
  rootDir?: string;
  enabled: boolean;
};

export function resolveChromiumPath(): string {
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

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    executablePath: resolveChromiumPath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
}

export function resolveSelectors(input: LoginSuiteInput): ResolvedLoginSelectors {
  return {
    form: input.selectors?.form ?? DEFAULT_SELECTORS.form,
    username: input.selectors?.username ?? DEFAULT_SELECTORS.username,
    password: input.selectors?.password ?? DEFAULT_SELECTORS.password,
    submit: input.selectors?.submit ?? DEFAULT_SELECTORS.submit,
    success: input.selectors?.success ?? DEFAULT_SELECTORS.success,
    authState: input.selectors?.authState ?? DEFAULT_SELECTORS.authState,
    error: input.selectors?.error ?? DEFAULT_SELECTORS.error,
    logout: input.selectors?.logout ?? DEFAULT_SELECTORS.logout,
    rememberMe: input.selectors?.rememberMe ?? DEFAULT_SELECTORS.rememberMe,
    loading: input.selectors?.loading ?? DEFAULT_SELECTORS.loading
  };
}

export function resolveAbsoluteUrl(baseUrl: string, maybeRelativeUrl: string): string {
  return new URL(maybeRelativeUrl, baseUrl).toString();
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function prepareArtifactsRoot(suiteId: string, input: LoginSuiteInput): Promise<ArtifactOptions> {
  const enabled = input.artifacts?.enabled ?? true;
  if (!enabled) {
    return { enabled: false };
  }

  const rootDir = resolve(process.cwd(), input.artifacts?.rootDir ?? ".artifacts/login", suiteId);

  try {
    await mkdir(rootDir, { recursive: true });
    return { rootDir, enabled: true };
  } catch {
    return { enabled: false };
  }
}

export async function prepareScenarioArtifactDir(
  artifactsRoot: ArtifactOptions,
  key: string
): Promise<string | undefined> {
  if (!artifactsRoot.enabled || !artifactsRoot.rootDir) {
    return undefined;
  }

  const dir = join(artifactsRoot.rootDir, `${Date.now()}-${slugify(key)}`);
  try {
    await mkdir(dir, { recursive: true });
    return dir;
  } catch {
    return undefined;
  }
}

function shouldCaptureResponse(response: Response, input: LoginSuiteInput, recordedCount: number): boolean {
  if (recordedCount >= 12) {
    return false;
  }

  const status = response.status();
  if (status >= 400) {
    return true;
  }

  if (input.api) {
    const apiUrl = resolveAbsoluteUrl(input.url, input.api.url);
    return response.url().startsWith(apiUrl);
  }

  return false;
}

async function previewResponseBody(response: Response): Promise<string | undefined> {
  try {
    const contentType = (await response.headerValue("content-type")) ?? "";
    if (!contentType.includes("application/json") && !contentType.includes("text/")) {
      return undefined;
    }

    return (await response.text()).slice(0, 400);
  } catch {
    return undefined;
  }
}

function trackConsoleErrors(session: MonitoredSession, message: ConsoleMessage): void {
  if (message.type() === "error") {
    session.consoleErrors.push(message.text());
  }
}

function trackFailedRequests(session: MonitoredSession, request: Request): void {
  session.failedRequests.push(
    `${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown request failure"})`
  );
}

async function trackResponse(session: MonitoredSession, response: Response, input: LoginSuiteInput): Promise<void> {
  if (!shouldCaptureResponse(response, input, session.httpObservations.length)) {
    return;
  }

  session.httpObservations.push({
    url: response.url(),
    method: response.request().method(),
    status: response.status(),
    bodyPreview: await previewResponseBody(response)
  });
}

export async function createMonitoredSession(
  browser: Browser,
  input: LoginSuiteInput,
  label: string,
  scenarioDir?: string,
  options?: BrowserContextOptions
): Promise<MonitoredSession> {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const session: MonitoredSession = {
    label,
    context,
    page,
    consoleErrors: [],
    failedRequests: [],
    httpObservations: [],
    tracePath: scenarioDir ? join(scenarioDir, `${slugify(label)}-trace.zip`) : undefined
  };

  page.on("console", (message) => {
    trackConsoleErrors(session, message);
  });
  page.on("requestfailed", (request) => {
    trackFailedRequests(session, request);
  });
  page.on("response", (response) => {
    void trackResponse(session, response, input);
  });

  if (session.tracePath) {
    try {
      await context.tracing.start({ screenshots: true, snapshots: true });
    } catch {
      session.tracePath = undefined;
    }
  }

  return session;
}

export async function finalizeMonitoredSession(
  session: MonitoredSession,
  status: LoginScenarioStatus,
  keepPassingArtifacts: boolean
): Promise<void> {
  if (session.tracePath) {
    try {
      await session.context.tracing.stop({ path: session.tracePath });
      if (status === "passed" && !keepPassingArtifacts) {
        await rm(session.tracePath, { force: true });
        session.tracePath = undefined;
      }
    } catch {
      session.tracePath = undefined;
    }
  }

  await session.context.close();
}

export async function captureFailureScreenshot(page: Page, scenarioDir?: string): Promise<string | undefined> {
  if (!scenarioDir) {
    return undefined;
  }

  const screenshotPath = join(scenarioDir, "failure.png");
  try {
    await page.screenshot({ path: screenshotPath, fullPage: true });
    return screenshotPath;
  } catch {
    return undefined;
  }
}

export async function snapshotSessionState(context: BrowserContext): Promise<LoginSessionSnapshot> {
  const storageState = await context.storageState();

  return {
    cookieNames: storageState.cookies.map((cookie) => cookie.name),
    cookies: storageState.cookies.map((cookie) => ({
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
      httpOnly: cookie.httpOnly,
      sameSite: cookie.sameSite,
      expires: cookie.expires,
      valueLength: cookie.value.length
    })),
    storage: storageState.origins.map((origin) => ({
      origin: origin.origin,
      localStorageKeys: origin.localStorage.map((entry) => entry.name),
      sessionStorageKeys: []
    }))
  };
}

export async function gotoAndWait(page: Page, url: string, timeoutMs: number): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await waitForUiToSettle(page, timeoutMs);
}

export async function waitForUiToSettle(page: Page, timeoutMs: number): Promise<void> {
  await page.waitForLoadState("domcontentloaded", { timeout: timeoutMs }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 2_000) }).catch(() => undefined);
  await page.waitForTimeout(150);
}

export async function ensureLocatorVisible(page: Page, selector: string, timeoutMs: number, label: string): Promise<void> {
  const locator = page.locator(selector).first();
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
  } catch {
    throw new ScenarioAssertionError(`Expected ${label} to be visible using selector: ${selector}`);
  }
}

export async function isSelectorVisible(page: Page, selector: string, timeoutMs: number): Promise<boolean> {
  const locator = page.locator(selector).first();
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

export async function collectVisibleText(page: Page, selector: string): Promise<string[]> {
  const texts = await page
    .locator(selector)
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const htmlElement = element as HTMLElement;
          return !htmlElement.hidden && htmlElement.offsetParent !== null;
        })
        .map((element) => element.textContent?.trim() ?? "")
        .filter((value) => value.length > 0)
    )
    .catch(() => []);

  return texts;
}

export async function readNativeValidationMessage(page: Page, selector: string): Promise<string | undefined> {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        return element.validationMessage || undefined;
      }

      return undefined;
    })
    .catch(() => undefined);
}

export async function fillLoginForm(
  page: Page,
  input: LoginSuiteInput,
  credentials: LoginCredential,
  timeoutMs: number,
  options?: { rememberMe?: boolean }
): Promise<void> {
  const selectors = resolveSelectors(input);

  await ensureLocatorVisible(page, selectors.username, timeoutMs, "username input");
  await ensureLocatorVisible(page, selectors.password, timeoutMs, "password input");

  await page.locator(selectors.username).first().fill(credentials.username, { timeout: timeoutMs });
  await page.locator(selectors.password).first().fill(credentials.password, { timeout: timeoutMs });

  if (options?.rememberMe && selectors.rememberMe) {
    const rememberMe = page.locator(selectors.rememberMe).first();
    if (await rememberMe.count()) {
      await rememberMe.check({ timeout: timeoutMs }).catch(() => undefined);
    }
  }
}

export async function submitLoginForm(
  page: Page,
  input: LoginSuiteInput,
  timeoutMs: number,
  options?: { repeatClicks?: number }
): Promise<void> {
  const selectors = resolveSelectors(input);
  await ensureLocatorVisible(page, selectors.submit, timeoutMs, "submit button");

  const repeatClicks = options?.repeatClicks ?? 1;
  for (let attempt = 0; attempt < repeatClicks; attempt += 1) {
    await page.locator(selectors.submit).first().click({ timeout: timeoutMs });
  }

  await waitForUiToSettle(page, timeoutMs);
}

export async function detectAuthenticatedState(page: Page, input: LoginSuiteInput, timeoutMs: number): Promise<boolean> {
  const selectors = resolveSelectors(input);

  if (input.expectations?.postLoginUrlIncludes && page.url().includes(input.expectations.postLoginUrlIncludes)) {
    return true;
  }

  if (await isSelectorVisible(page, selectors.success, Math.min(timeoutMs, 1_500))) {
    return true;
  }

  if (await isSelectorVisible(page, selectors.authState, Math.min(timeoutMs, 1_500))) {
    return true;
  }

  return false;
}

export async function assertAuthenticatedState(page: Page, input: LoginSuiteInput, timeoutMs: number): Promise<void> {
  if (await detectAuthenticatedState(page, input, timeoutMs)) {
    return;
  }

  const selectors = resolveSelectors(input);
  const errors = await collectVisibleText(page, selectors.error);
  const errorSuffix = errors.length > 0 ? ` Visible error: ${errors.join(" | ")}` : "";
  throw new ScenarioAssertionError(`Expected authenticated UI or redirect after login.${errorSuffix}`);
}

export async function assertAnonymousState(page: Page, input: LoginSuiteInput, timeoutMs: number): Promise<void> {
  if (await detectAuthenticatedState(page, input, Math.min(timeoutMs, 1_500))) {
    throw new ScenarioAssertionError("Expected the session to remain anonymous, but authenticated UI became visible.");
  }
}

export async function assertProtectedRouteBlocked(page: Page, input: LoginSuiteInput, timeoutMs: number): Promise<void> {
  const protectedUrl = input.expectations?.protectedUrl;
  if (!protectedUrl) {
    throw new ScenarioSkipError("No expectations.protectedUrl configured.");
  }

  await gotoAndWait(page, resolveAbsoluteUrl(input.url, protectedUrl), timeoutMs);

  if (input.expectations?.unauthorizedUrlIncludes && page.url().includes(input.expectations.unauthorizedUrlIncludes)) {
    return;
  }

  const loginUrl = new URL(input.url);
  const currentUrl = new URL(page.url(), input.url);
  if (currentUrl.origin === loginUrl.origin && currentUrl.pathname === loginUrl.pathname) {
    return;
  }

  const selectors = resolveSelectors(input);
  if (await isSelectorVisible(page, selectors.form, Math.min(timeoutMs, 1_000))) {
    return;
  }

  throw new ScenarioAssertionError(
    `Expected unauthenticated access to ${protectedUrl} to be blocked, but no redirect or login form was detected.`
  );
}

export async function assertProtectedRouteAccessible(page: Page, input: LoginSuiteInput, timeoutMs: number): Promise<void> {
  const protectedUrl = input.expectations?.protectedUrl;
  if (!protectedUrl) {
    throw new ScenarioSkipError("No expectations.protectedUrl configured.");
  }

  await gotoAndWait(page, resolveAbsoluteUrl(input.url, protectedUrl), timeoutMs);
  await assertAuthenticatedState(page, input, timeoutMs);
}

export function summarizeDifference(left: string | undefined, right: string | undefined): boolean {
  return (left ?? "").trim() !== (right ?? "").trim();
}

export function guessInvalidCredentials(input: LoginSuiteInput): LoginCredential {
  if (input.invalidCredentials) {
    return input.invalidCredentials;
  }

  if (input.credentials) {
    return {
      username: input.credentials.username,
      password: `${input.credentials.password}-invalid`,
      label: "guessed-invalid"
    };
  }

  return {
    username: "nobody@example.invalid",
    password: "invalid-password",
    label: "fallback-invalid"
  };
}

export function guessUnknownUserCredentials(input: LoginSuiteInput): LoginCredential {
  if (input.invalidCredentials) {
    return {
      username: input.invalidCredentials.username,
      password: input.invalidCredentials.password,
      label: input.invalidCredentials.label ?? "unknown-user"
    };
  }

  return {
    username: "unknown-user@example.invalid",
    password: input.credentials?.password ?? "invalid-password",
    label: "unknown-user"
  };
}

export function sanitizePotentialLeakText(text: string): string[] {
  const patterns = [
    /exception/i,
    /stack/i,
    /trace/i,
    /sql/i,
    /syntax error/i,
    /internal server error/i,
    /role/i,
    /select .* from/i
  ];

  return patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

export async function probeWebSocket(page: Page, wsUrl: string, timeoutMs: number): Promise<LoginWebSocketProbeResult> {
  return page.evaluate(
    ({ wsUrl: targetUrl, timeout }) =>
      new Promise<LoginWebSocketProbeResult>((resolve) => {
        const messages: string[] = [];
        let opened = false;
        let closed = false;
        let closeCode: number | null = null;
        let settled = false;

        const finish = (result: LoginWebSocketProbeResult) => {
          if (settled) {
            return;
          }

          settled = true;
          resolve(result);
        };

        const socket = new WebSocket(targetUrl);

        const timer = window.setTimeout(() => {
          try {
            socket.close();
          } catch {
            // No-op on timeout cleanup.
          }

          finish({
            opened,
            closed,
            closeCode,
            messages,
            error: null
          });
        }, timeout);

        socket.addEventListener("open", () => {
          opened = true;
        });

        socket.addEventListener("message", (event) => {
          messages.push(typeof event.data === "string" ? event.data : String(event.data));
        });

        socket.addEventListener("error", () => {
          window.clearTimeout(timer);
          finish({
            opened,
            closed,
            closeCode,
            messages,
            error: "websocket-error"
          });
        });

        socket.addEventListener("close", (event) => {
          closed = true;
          closeCode = event.code;
          window.clearTimeout(timer);
          finish({
            opened,
            closed,
            closeCode,
            messages,
            error: null
          });
        });
      }),
    { wsUrl, timeout: timeoutMs }
  );
}

export async function maybeRemoveScenarioDir(scenarioDir: string | undefined, keepArtifacts: boolean): Promise<void> {
  if (!scenarioDir || keepArtifacts) {
    return;
  }

  try {
    await rm(scenarioDir, { recursive: true, force: true });
  } catch {
    // Artifact cleanup is best effort only.
  }
}
