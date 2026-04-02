import type { Browser, BrowserContextOptions, Page } from "playwright-core";
import type {
  LegacyLoginBotInput,
  LoginCredential,
  LoginMultiuserRealtimeBotInput,
  LoginSecurityBotInput,
  LoginSessionLifecycleBotInput,
  LoginSmokeBotInput,
  LoginSuiteInput,
  LoginValidationBotInput
} from "./schema";
import {
  DEFAULT_API_FAILURE_STATUSES,
  DEFAULT_TIMEOUT_MS,
  ScenarioAssertionError,
  ScenarioSkipError,
  assertAnonymousState,
  assertAuthenticatedState,
  assertProtectedRouteAccessible,
  assertProtectedRouteBlocked,
  captureFailureScreenshot,
  collectVisibleText,
  createMonitoredSession,
  detectAuthenticatedState,
  ensureLocatorVisible,
  fillLoginForm,
  finalizeMonitoredSession,
  gotoAndWait,
  guessInvalidCredentials,
  guessUnknownUserCredentials,
  launchBrowser,
  maybeRemoveScenarioDir,
  prepareArtifactsRoot,
  prepareScenarioArtifactDir,
  probeWebSocket,
  readNativeValidationMessage,
  resolveAbsoluteUrl,
  resolveSelectors,
  sanitizePotentialLeakText,
  slugify,
  snapshotSessionState,
  submitLoginForm,
  summarizeDifference,
  waitForUiToSettle,
  type LoginHttpObservation,
  type LoginScenarioStatus,
  type LoginSessionSnapshot,
  type MonitoredSession
} from "./shared";

type ApiCallResult = {
  status: number;
  ok: boolean;
  bodyPreview: string;
  headers: Record<string, string>;
};

export type LoginScenarioArtifacts = {
  scenarioDir?: string;
  screenshotPath?: string;
  tracePaths: string[];
};

export type LoginSuiteScenarioResult = {
  key: string;
  title: string;
  status: LoginScenarioStatus;
  durationMs: number;
  notes: string[];
  errors: string[];
  finalUrl?: string;
  consoleErrors: string[];
  failedRequests: string[];
  httpObservations: LoginHttpObservation[];
  artifacts: LoginScenarioArtifacts;
  session?: LoginSessionSnapshot;
};

export type LoginSuiteResult = {
  suite: string;
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: {
    passed: number;
    failed: number;
    skipped: number;
  };
  artifactsDir?: string;
  scenarios: LoginSuiteScenarioResult[];
};

export type LegacyLoginBotResult = LoginSuiteResult;
export type LoginBotResult = LoginSuiteResult;
export type LoginSmokeBotResult = LoginSuiteResult;
export type LoginValidationBotResult = LoginSuiteResult;
export type LoginSecurityBotResult = LoginSuiteResult;
export type LoginSessionLifecycleBotResult = LoginSuiteResult;
export type LoginMultiuserRealtimeBotResult = LoginSuiteResult;

type ScenarioContext = {
  input: LoginSuiteInput;
  timeoutMs: number;
  note(message: string): void;
  assert(condition: unknown, message: string): void;
  skip(message: string): never;
  createSession(label: string, options?: BrowserContextOptions): Promise<MonitoredSession>;
  openLoginPage(session: MonitoredSession): Promise<void>;
  loginViaUi(
    session: MonitoredSession,
    credentials: LoginCredential,
    options?: { rememberMe?: boolean; repeatClicks?: number }
  ): Promise<void>;
  expectAuthenticated(session: MonitoredSession): Promise<void>;
  expectAnonymous(session: MonitoredSession): Promise<void>;
  assertProtectedRouteBlocked(session: MonitoredSession): Promise<void>;
  assertProtectedRouteAccessible(session: MonitoredSession): Promise<void>;
  getFeedbackTexts(session: MonitoredSession): Promise<string[]>;
  getNativeValidationMessage(session: MonitoredSession, field: "username" | "password"): Promise<string | undefined>;
  callLoginApi(payload: Record<string, unknown>): Promise<ApiCallResult>;
};

type SuiteContext = {
  suiteId: string;
  input: LoginSuiteInput;
  browser: Browser;
  timeoutMs: number;
  artifactsDir?: string;
  keepPassingArtifacts: boolean;
};

function normalizeComparableText(value: string | undefined): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function ensureFailureStatus(status: number, input: LoginSuiteInput): boolean {
  const expected = input.api?.failureStatuses ?? DEFAULT_API_FAILURE_STATUSES;
  return expected.includes(status) || (status >= 400 && status < 500);
}

function summarizeScenarios(scenarios: LoginSuiteScenarioResult[]): LoginSuiteResult["summary"] {
  return scenarios.reduce(
    (accumulator, scenario) => {
      accumulator[scenario.status] += 1;
      return accumulator;
    },
    {
      passed: 0,
      failed: 0,
      skipped: 0
    }
  );
}

async function createApiCallResult(response: Response): Promise<ApiCallResult> {
  const bodyPreview = await response.text().catch(() => "");

  return {
    status: response.status,
    ok: response.ok,
    bodyPreview: bodyPreview.slice(0, 400),
    headers: Object.fromEntries(response.headers.entries())
  };
}

function buildApiPayload(input: LoginSuiteInput, credentials?: LoginCredential): Record<string, unknown> {
  const usernameField = input.api?.usernameField ?? "username";
  const passwordField = input.api?.passwordField ?? "password";

  return {
    ...(input.api?.extraBody ?? {}),
    ...(credentials
      ? {
          [usernameField]: credentials.username,
          [passwordField]: credentials.password
        }
      : {})
  };
}

async function callLoginApi(input: LoginSuiteInput, payload: Record<string, unknown>, timeoutMs: number): Promise<ApiCallResult> {
  if (!input.api) {
    throw new ScenarioSkipError("No api config provided for direct request checks.");
  }

  const targetUrl = resolveAbsoluteUrl(input.url, input.api.url);
  const method = input.api.method ?? "POST";
  const contentType = input.api.contentType ?? "json";
  const headers = new Headers(input.api.headers ?? {});
  let body: string | URLSearchParams;

  if (contentType === "form") {
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) {
        continue;
      }

      formData.set(key, String(value));
    }
    headers.set("Content-Type", "application/x-www-form-urlencoded; charset=utf-8");
    body = formData;
  } else {
    headers.set("Content-Type", "application/json; charset=utf-8");
    body = JSON.stringify(payload);
  }

  const response = await fetch(targetUrl, {
    method,
    headers,
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs)
  });

  return createApiCallResult(response);
}

async function clearPageStorage(page: Page): Promise<void> {
  await page
    .evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    })
    .catch(() => undefined);
}

async function openLoginPage(session: MonitoredSession, input: LoginSuiteInput, timeoutMs: number): Promise<void> {
  const selectors = resolveSelectors(input);
  await gotoAndWait(session.page, input.url, timeoutMs);
  await ensureLocatorVisible(session.page, selectors.form, timeoutMs, "login form");
}

async function loginViaUi(
  session: MonitoredSession,
  input: LoginSuiteInput,
  credentials: LoginCredential,
  timeoutMs: number,
  options?: { rememberMe?: boolean; repeatClicks?: number }
): Promise<void> {
  await openLoginPage(session, input, timeoutMs);
  await fillLoginForm(session.page, input, credentials, timeoutMs, { rememberMe: options?.rememberMe });
  await submitLoginForm(session.page, input, timeoutMs, { repeatClicks: options?.repeatClicks });
}

async function readScenarioSessionSnapshot(session: MonitoredSession | undefined): Promise<LoginSessionSnapshot | undefined> {
  if (!session) {
    return undefined;
  }

  return snapshotSessionState(session.context).catch(() => undefined);
}

async function compareAnonymousFeedback(
  ctx: ScenarioContext,
  credentials: LoginCredential
): Promise<{ feedbackText?: string; apiResponse?: ApiCallResult }> {
  const session = await ctx.createSession(`feedback-${slugify(credentials.label ?? credentials.username)}`);
  await ctx.loginViaUi(session, credentials);
  await ctx.expectAnonymous(session);
  const feedbackTexts = await ctx.getFeedbackTexts(session);
  if (feedbackTexts.length > 0) {
    return { feedbackText: feedbackTexts.join(" | ") };
  }

  if (ctx.input.api) {
    return {
      apiResponse: await ctx.callLoginApi(buildApiPayload(ctx.input, credentials))
    };
  }

  return {};
}

async function runScenario(
  suite: SuiteContext,
  key: string,
  title: string,
  execute: (ctx: ScenarioContext) => Promise<void>
): Promise<LoginSuiteScenarioResult> {
  const startedAt = Date.now();
  const notes: string[] = [];
  const errors: string[] = [];
  const sessions: MonitoredSession[] = [];
  const scenarioDir = await prepareScenarioArtifactDir(
    { enabled: Boolean(suite.artifactsDir), rootDir: suite.artifactsDir },
    key
  );
  let status: LoginScenarioStatus = "passed";
  let screenshotPath: string | undefined;

  const ctx: ScenarioContext = {
    input: suite.input,
    timeoutMs: suite.timeoutMs,
    note(message) {
      notes.push(message);
    },
    assert(condition, message) {
      if (!condition) {
        throw new ScenarioAssertionError(message);
      }
    },
    skip(message): never {
      throw new ScenarioSkipError(message);
    },
    async createSession(label, options) {
      const session = await createMonitoredSession(suite.browser, suite.input, label, scenarioDir, options);
      sessions.push(session);
      return session;
    },
    async openLoginPage(session) {
      await openLoginPage(session, suite.input, suite.timeoutMs);
    },
    async loginViaUi(session, credentials, options) {
      await loginViaUi(session, suite.input, credentials, suite.timeoutMs, options);
    },
    async expectAuthenticated(session) {
      await assertAuthenticatedState(session.page, suite.input, suite.timeoutMs);
    },
    async expectAnonymous(session) {
      await assertAnonymousState(session.page, suite.input, suite.timeoutMs);
    },
    async assertProtectedRouteBlocked(session) {
      await assertProtectedRouteBlocked(session.page, suite.input, suite.timeoutMs);
    },
    async assertProtectedRouteAccessible(session) {
      await assertProtectedRouteAccessible(session.page, suite.input, suite.timeoutMs);
    },
    async getFeedbackTexts(session) {
      return collectVisibleText(session.page, resolveSelectors(suite.input).error);
    },
    async getNativeValidationMessage(session, field) {
      const selector = field === "username" ? resolveSelectors(suite.input).username : resolveSelectors(suite.input).password;
      return readNativeValidationMessage(session.page, selector);
    },
    async callLoginApi(payload) {
      return callLoginApi(suite.input, payload, suite.timeoutMs);
    }
  };

  try {
    await execute(ctx);
  } catch (error) {
    if (error instanceof ScenarioSkipError) {
      status = "skipped";
      notes.push(error.message);
    } else {
      status = "failed";
      errors.push(error instanceof Error ? error.message : "Unknown scenario error");
      const screenshotSession = sessions.at(-1);
      screenshotPath = screenshotSession ? await captureFailureScreenshot(screenshotSession.page, scenarioDir) : undefined;
    }
  }

  const primarySession = sessions[0];
  const finalUrl = primarySession?.page.url();
  const sessionSnapshot = await readScenarioSessionSnapshot(primarySession);

  for (const session of sessions) {
    await finalizeMonitoredSession(session, status, suite.keepPassingArtifacts);
  }

  const tracePaths = sessions
    .map((session) => session.tracePath)
    .filter((tracePath): tracePath is string => typeof tracePath === "string");

  if (status === "passed" && !suite.keepPassingArtifacts) {
    await maybeRemoveScenarioDir(scenarioDir, false);
  }

  return {
    key,
    title,
    status,
    durationMs: Date.now() - startedAt,
    notes,
    errors,
    finalUrl,
    consoleErrors: sessions.flatMap((session) => session.consoleErrors),
    failedRequests: sessions.flatMap((session) => session.failedRequests),
    httpObservations: sessions.flatMap((session) => session.httpObservations),
    artifacts: {
      scenarioDir,
      screenshotPath,
      tracePaths
    },
    session: sessionSnapshot
  };
}

async function runSuite(
  suiteId: string,
  input: LoginSuiteInput,
  scenariosFactory: (ctx: SuiteContext) => Promise<LoginSuiteScenarioResult[]>
): Promise<LoginSuiteResult> {
  const startedAt = new Date();
  const browser = await launchBrowser();
  const artifacts = await prepareArtifactsRoot(suiteId, input);
  const keepPassingArtifacts = input.artifacts?.keepPassingArtifacts ?? true;

  try {
    const suiteContext: SuiteContext = {
      suiteId,
      input,
      browser,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      artifactsDir: artifacts.rootDir,
      keepPassingArtifacts
    };

    const scenarios = await scenariosFactory(suiteContext);
    const summary = summarizeScenarios(scenarios);

    return {
      suite: suiteId,
      ok: summary.failed === 0,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      summary,
      artifactsDir: artifacts.rootDir,
      scenarios
    };
  } finally {
    await browser.close();
  }
}

async function runLoginSmokeSuite(suite: SuiteContext): Promise<LoginSuiteScenarioResult[]> {
  const credentials = suite.input.credentials;
  if (!credentials) {
    throw new ScenarioAssertionError("login-smoke requires credentials.");
  }

  return [
    await runScenario(suite, "page-ready", "login page loads and form is ready", async (ctx) => {
      const session = await ctx.createSession("page-ready");
      const selectors = resolveSelectors(ctx.input);

      await ctx.openLoginPage(session);
      await ensureLocatorVisible(session.page, selectors.username, ctx.timeoutMs, "username input");
      await ensureLocatorVisible(session.page, selectors.password, ctx.timeoutMs, "password input");
      await ensureLocatorVisible(session.page, selectors.submit, ctx.timeoutMs, "submit button");
      await fillLoginForm(session.page, ctx.input, credentials, ctx.timeoutMs);

      ctx.note("Login form and its main controls were found and can be filled.");
    }),
    await runScenario(suite, "valid-login", "valid credentials grant access", async (ctx) => {
      const session = await ctx.createSession("valid-login");

      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      if (ctx.input.expectations?.protectedUrl) {
        await ctx.assertProtectedRouteAccessible(session);
      }

      ctx.note(`Validated authenticated UI with user ${credentials.label ?? credentials.username}.`);
    }),
    await runScenario(suite, "reload-persists", "session persists after reload", async (ctx) => {
      if (ctx.input.expectations?.sessionPersistsAfterReload === false) {
        ctx.skip("expectations.sessionPersistsAfterReload is disabled for this target.");
      }

      const session = await ctx.createSession("reload-persists");
      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      await session.page.reload({ waitUntil: "domcontentloaded", timeout: ctx.timeoutMs });
      await waitForUiToSettle(session.page, ctx.timeoutMs);
      await ctx.expectAuthenticated(session);
    }),
    await runScenario(suite, "already-authenticated-login-route", "authenticated user revisiting /login is handled correctly", async (ctx) => {
      const alreadyAuthenticatedUrlIncludes = ctx.input.expectations?.alreadyAuthenticatedUrlIncludes;
      if (!alreadyAuthenticatedUrlIncludes) {
        ctx.skip("No expectations.alreadyAuthenticatedUrlIncludes configured.");
      }
      const expectedRedirect = alreadyAuthenticatedUrlIncludes as string;

      const session = await ctx.createSession("already-authenticated");
      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      await gotoAndWait(session.page, ctx.input.url, ctx.timeoutMs);
      ctx.assert(
        session.page.url().includes(expectedRedirect),
        `Expected revisiting /login to land on a URL containing ${expectedRedirect}.`
      );
    }),
    await runScenario(suite, "logout", "logout removes authenticated state", async (ctx) => {
      const selectors = resolveSelectors(ctx.input);
      if (!selectors.logout) {
        ctx.skip("No logout selector configured.");
      }

      const session = await ctx.createSession("logout");
      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      await ensureLocatorVisible(session.page, selectors.logout, ctx.timeoutMs, "logout control");
      await session.page.locator(selectors.logout).first().click({ timeout: ctx.timeoutMs });
      await waitForUiToSettle(session.page, ctx.timeoutMs);
      await ctx.expectAnonymous(session);

      const logoutRedirectUrlIncludes = ctx.input.expectations?.logoutRedirectUrlIncludes;
      if (logoutRedirectUrlIncludes) {
        ctx.assert(
          session.page.url().includes(logoutRedirectUrlIncludes),
          `Expected logout redirect to contain ${logoutRedirectUrlIncludes}.`
        );
      }
    })
  ];
}

async function runLoginValidationSuite(suite: SuiteContext): Promise<LoginSuiteScenarioResult[]> {
  return [
    await runScenario(suite, "empty-form", "empty form submit is rejected with visible feedback", async (ctx) => {
      const session = await ctx.createSession("empty-form");

      await ctx.openLoginPage(session);
      await submitLoginForm(session.page, ctx.input, ctx.timeoutMs);
      await ctx.expectAnonymous(session);

      const usernameMessage = await ctx.getNativeValidationMessage(session, "username");
      const passwordMessage = await ctx.getNativeValidationMessage(session, "password");
      const feedbackTexts = await ctx.getFeedbackTexts(session);

      ctx.assert(
        Boolean(usernameMessage || passwordMessage || feedbackTexts.length > 0),
        "Expected either native validation feedback or a visible UI error for an empty submit."
      );

      if (usernameMessage) {
        ctx.note(`Username validation: ${usernameMessage}`);
      }
      if (passwordMessage) {
        ctx.note(`Password validation: ${passwordMessage}`);
      }
      if (feedbackTexts.length > 0) {
        ctx.note(`Visible UI feedback: ${feedbackTexts.join(" | ")}`);
      }
    }),
    await runScenario(suite, "invalid-email", "invalid email format is rejected cleanly", async (ctx) => {
      if (ctx.input.validation?.identityKind !== "email") {
        ctx.skip("validation.identityKind is not configured as email.");
      }

      const session = await ctx.createSession("invalid-email");
      await ctx.openLoginPage(session);
      await fillLoginForm(
        session.page,
        ctx.input,
        {
          username: "invalid-email-format",
          password: guessInvalidCredentials(ctx.input).password,
          label: "invalid-email"
        },
        ctx.timeoutMs
      );
      await submitLoginForm(session.page, ctx.input, ctx.timeoutMs);
      await ctx.expectAnonymous(session);

      const usernameMessage = await ctx.getNativeValidationMessage(session, "username");
      const feedbackTexts = await ctx.getFeedbackTexts(session);
      ctx.assert(
        Boolean(usernameMessage || feedbackTexts.length > 0),
        "Expected invalid email input to trigger visible feedback."
      );
    }),
    await runScenario(suite, "unicode-inputs", "unusual unicode and emoji inputs do not break the flow", async (ctx) => {
      const session = await ctx.createSession("unicode-inputs");
      const unusualIdentity = ctx.input.validation?.unusualIdentity ?? "odd-user-\u200b-\ud83d\ude00";
      const unusualPassword = ctx.input.validation?.unusualPassword ?? "odd-pass-\u2028-\ud83d\ude80";

      await ctx.openLoginPage(session);
      await fillLoginForm(
        session.page,
        ctx.input,
        {
          username: ctx.input.credentials?.username ?? unusualIdentity,
          password: unusualPassword,
          label: "unicode-input"
        },
        ctx.timeoutMs
      );
      await submitLoginForm(session.page, ctx.input, ctx.timeoutMs);
      await ctx.expectAnonymous(session);

      ctx.assert(session.consoleErrors.length === 0, "Unicode input should not trigger console errors.");
      ctx.assert(
        session.httpObservations.every((observation) => observation.status < 500),
        "Unicode input should not produce HTTP 500 responses."
      );
    }),
    await runScenario(suite, "long-password", "overlong passwords are rejected without server errors", async (ctx) => {
      const session = await ctx.createSession("long-password");
      const longPassword = "x".repeat(ctx.input.validation?.longPasswordLength ?? 4_096);

      await ctx.openLoginPage(session);
      await fillLoginForm(
        session.page,
        ctx.input,
        {
          username: ctx.input.credentials?.username ?? "length-check@example.invalid",
          password: longPassword,
          label: "long-password"
        },
        ctx.timeoutMs
      );
      await submitLoginForm(session.page, ctx.input, ctx.timeoutMs);
      await ctx.expectAnonymous(session);

      ctx.assert(
        session.httpObservations.every((observation) => observation.status < 500),
        "Long-password validation should not trigger HTTP 500 responses."
      );
    }),
    await runScenario(suite, "double-submit", "rapid double submit stays stable", async (ctx) => {
      const session = await ctx.createSession("double-submit");
      const credentials = guessInvalidCredentials(ctx.input);

      await ctx.openLoginPage(session);
      await fillLoginForm(session.page, ctx.input, credentials, ctx.timeoutMs);
      await submitLoginForm(session.page, ctx.input, ctx.timeoutMs, { repeatClicks: 2 });
      await ctx.expectAnonymous(session);

      ctx.assert(session.consoleErrors.length === 0, "Rapid double submit should not emit console errors.");
      ctx.assert(
        session.httpObservations.every((observation) => observation.status < 500),
        "Rapid double submit should not generate HTTP 500 responses."
      );
    }),
    await runScenario(suite, "malformed-api-payloads", "backend rejects malformed payloads cleanly", async (ctx) => {
      const api = ctx.input.api;
      if (!api) {
        ctx.skip("No api config provided.");
      }
      const apiConfig = api as NonNullable<LoginSuiteInput["api"]>;

      const malformedPayloads: Array<{ label: string; payload: Record<string, unknown> }> = [
        {
          label: "missing-password",
          payload: { ...(apiConfig.extraBody ?? {}), [apiConfig.usernameField ?? "username"]: "bot-user" }
        },
        {
          label: "null-password",
          payload: {
            ...(apiConfig.extraBody ?? {}),
            [apiConfig.usernameField ?? "username"]: "bot-user",
            [apiConfig.passwordField ?? "password"]: null
          }
        },
        {
          label: "array-password",
          payload: {
            ...(apiConfig.extraBody ?? {}),
            [apiConfig.usernameField ?? "username"]: "bot-user",
            [apiConfig.passwordField ?? "password"]: ["x", "y"]
          }
        }
      ];

      for (const malformedPayload of malformedPayloads) {
        const response = await ctx.callLoginApi(malformedPayload.payload);
        ctx.assert(
          ensureFailureStatus(response.status, ctx.input),
          `Expected malformed payload ${malformedPayload.label} to be rejected. Got status ${response.status}.`
        );
        ctx.assert(response.status < 500, `Malformed payload ${malformedPayload.label} produced status ${response.status}.`);
      }
    }),
    await runScenario(suite, "recovery-valid-login", "valid credentials still work after validation failures", async (ctx) => {
      const validCredentials = ctx.input.credentials;
      if (!validCredentials) {
        ctx.skip("No valid credentials configured.");
      }
      const expectedCredentials = validCredentials as LoginCredential;

      const session = await ctx.createSession("recovery-valid-login");
      await ctx.loginViaUi(session, expectedCredentials);
      await ctx.expectAuthenticated(session);
    })
  ];
}

async function runLoginSecuritySuite(suite: SuiteContext): Promise<LoginSuiteScenarioResult[]> {
  return [
    await runScenario(suite, "wrong-password", "wrong password is denied without sensitive leaks", async (ctx) => {
      const invalidCredentials = guessInvalidCredentials(ctx.input);
      const session = await ctx.createSession("wrong-password");

      await ctx.loginViaUi(session, invalidCredentials);
      await ctx.expectAnonymous(session);

      const feedbackTexts = await ctx.getFeedbackTexts(session);
      const combinedText = `${feedbackTexts.join(" ")} ${session.httpObservations.map((item) => item.bodyPreview ?? "").join(" ")}`;
      const leakSignals = sanitizePotentialLeakText(combinedText);
      ctx.assert(
        leakSignals.length === 0,
        `Wrong-password feedback looks too revealing. Matched patterns: ${leakSignals.join(", ")}.`
      );
    }),
    await runScenario(suite, "unknown-user-mask", "unknown users are handled consistently", async (ctx) => {
      const wrongPasswordFeedback = await compareAnonymousFeedback(ctx, guessInvalidCredentials(ctx.input));
      const unknownUserFeedback = await compareAnonymousFeedback(ctx, guessUnknownUserCredentials(ctx.input));
      const shouldMaskUserEnumeration = ctx.input.security?.maskUserEnumeration ?? true;

      if (wrongPasswordFeedback.apiResponse && unknownUserFeedback.apiResponse) {
        ctx.assert(
          ensureFailureStatus(wrongPasswordFeedback.apiResponse.status, ctx.input) &&
            ensureFailureStatus(unknownUserFeedback.apiResponse.status, ctx.input),
          "Both wrong-password and unknown-user API calls must be rejected."
        );

        if (shouldMaskUserEnumeration) {
          ctx.assert(
            wrongPasswordFeedback.apiResponse.status === unknownUserFeedback.apiResponse.status,
            "Unknown-user and wrong-password responses use different HTTP statuses."
          );
        }
      }

      if (shouldMaskUserEnumeration) {
        const wrongText = normalizeComparableText(wrongPasswordFeedback.feedbackText ?? wrongPasswordFeedback.apiResponse?.bodyPreview);
        const unknownText = normalizeComparableText(unknownUserFeedback.feedbackText ?? unknownUserFeedback.apiResponse?.bodyPreview);

        if (wrongText && unknownText) {
          ctx.assert(!summarizeDifference(wrongText, unknownText), "Unknown-user feedback differs from wrong-password feedback.");
        } else {
          ctx.note("No comparable feedback text was captured, so user-enumeration masking was checked via status only.");
        }
      }
    }),
    await runScenario(suite, "protected-route-anonymous", "protected routes are blocked without authentication", async (ctx) => {
      const session = await ctx.createSession("protected-route-anonymous");
      await ctx.assertProtectedRouteBlocked(session);
    }),
    await runScenario(suite, "concurrent-invalid-attempts", "concurrent invalid attempts remain stable", async (ctx) => {
      const api = ctx.input.api;
      if (!api) {
        ctx.skip("No api config provided.");
      }

      const invalidCredentials = guessInvalidCredentials(ctx.input);
      const attemptCount = ctx.input.security?.concurrentAttemptCount ?? 5;
      const payload = buildApiPayload(ctx.input, invalidCredentials);
      const responses = await Promise.all(Array.from({ length: attemptCount }, () => ctx.callLoginApi(payload)));

      ctx.assert(
        responses.every((response) => ensureFailureStatus(response.status, ctx.input)),
        "Concurrent invalid attempts must be rejected consistently."
      );
      ctx.assert(
        responses.every((response) => response.status < 500),
        "Concurrent invalid attempts must not generate HTTP 500 responses."
      );
    }),
    await runScenario(suite, "session-replay-after-logout", "old session state cannot be replayed after logout", async (ctx) => {
      const credentials = ctx.input.credentials;
      const logoutSelector = resolveSelectors(ctx.input).logout;
      const protectedUrl = ctx.input.expectations?.protectedUrl;
      if (!credentials || !logoutSelector || !protectedUrl) {
        ctx.skip("Replay check requires credentials, a logout selector, and expectations.protectedUrl.");
      }
      const replayCredentials = credentials as LoginCredential;

      const session = await ctx.createSession("session-replay");
      await ctx.loginViaUi(session, replayCredentials);
      await ctx.expectAuthenticated(session);
      const storageState = await session.context.storageState();

      await ensureLocatorVisible(session.page, logoutSelector, ctx.timeoutMs, "logout control");
      await session.page.locator(logoutSelector).first().click({ timeout: ctx.timeoutMs });
      await waitForUiToSettle(session.page, ctx.timeoutMs);
      await ctx.expectAnonymous(session);

      const replaySession = await ctx.createSession("session-replay-restored", { storageState });
      await ctx.assertProtectedRouteBlocked(replaySession);
    }),
    await runScenario(suite, "malformed-api-security", "malformed API bodies do not crash the backend", async (ctx) => {
      const api = ctx.input.api;
      if (!api) {
        ctx.skip("No api config provided.");
      }
      const apiConfig = api as NonNullable<LoginSuiteInput["api"]>;

      const payloads = [
        { label: "boolean-password", payload: { ...buildApiPayload(ctx.input), [apiConfig.passwordField ?? "password"]: true } },
        { label: "numeric-username", payload: { ...buildApiPayload(ctx.input), [apiConfig.usernameField ?? "username"]: 12345 } }
      ];

      for (const payload of payloads) {
        const response = await ctx.callLoginApi(payload.payload);
        ctx.assert(response.status < 500, `${payload.label} produced a server error.`);
      }
    })
  ];
}

async function runLoginSessionLifecycleSuite(suite: SuiteContext): Promise<LoginSuiteScenarioResult[]> {
  const credentials = suite.input.credentials;
  if (!credentials) {
    throw new ScenarioAssertionError("login-session-lifecycle requires credentials.");
  }

  return [
    await runScenario(suite, "session-created", "login creates observable session state", async (ctx) => {
      const session = await ctx.createSession("session-created");
      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      const snapshot = await snapshotSessionState(session.context);
      const expectedCookies = ctx.input.expectations?.expectedCookieNames ?? [];
      const expectedStorageKeys = ctx.input.expectations?.expectedStorageKeys ?? [];

      if (expectedCookies.length > 0) {
        ctx.assert(
          expectedCookies.every((cookieName) => snapshot.cookieNames.includes(cookieName)),
          `Expected cookies not found. Wanted: ${expectedCookies.join(", ")}.`
        );
      }

      if (expectedStorageKeys.length > 0) {
        const storageKeys = snapshot.storage.flatMap((entry) => entry.localStorageKeys);
        ctx.assert(
          expectedStorageKeys.every((storageKey) => storageKeys.includes(storageKey)),
          `Expected storage keys not found. Wanted: ${expectedStorageKeys.join(", ")}.`
        );
      }

      const hasObservableSessionEvidence =
        snapshot.cookieNames.length > 0 || snapshot.storage.some((entry) => entry.localStorageKeys.length > 0);

      if (ctx.input.expectations?.protectedUrl) {
        await ctx.assertProtectedRouteAccessible(session);
      } else {
        ctx.assert(
          hasObservableSessionEvidence,
          "No observable session evidence was found. Configure expectations.protectedUrl or expectedCookieNames/expectedStorageKeys."
        );
      }

      ctx.note(`Observed ${snapshot.cookieNames.length} cookies and ${snapshot.storage.length} storage origins after login.`);
    }),
    await runScenario(suite, "reload-persists", "reload keeps the session alive", async (ctx) => {
      if (ctx.input.expectations?.sessionPersistsAfterReload === false) {
        ctx.skip("expectations.sessionPersistsAfterReload is disabled.");
      }

      const session = await ctx.createSession("reload-session");
      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      await session.page.reload({ waitUntil: "domcontentloaded", timeout: ctx.timeoutMs });
      await waitForUiToSettle(session.page, ctx.timeoutMs);
      await ctx.expectAuthenticated(session);
    }),
    await runScenario(suite, "new-tab-shares-session", "new tabs in the same browser context share authentication", async (ctx) => {
      if (ctx.input.expectations?.sessionPersistsAcrossTabs === false) {
        ctx.skip("expectations.sessionPersistsAcrossTabs is disabled.");
      }

      const session = await ctx.createSession("new-tab-shares-session");
      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      const secondPage = await session.context.newPage();
      await gotoAndWait(secondPage, ctx.input.expectations?.protectedUrl ? resolveAbsoluteUrl(ctx.input.url, ctx.input.expectations.protectedUrl) : ctx.input.url, ctx.timeoutMs);

      ctx.assert(
        await detectAuthenticatedState(secondPage, ctx.input, ctx.timeoutMs),
        "Second tab did not inherit the authenticated state."
      );
    }),
    await runScenario(suite, "logout-invalidates-tabs", "logout removes access in sibling tabs", async (ctx) => {
      const logoutSelector = resolveSelectors(ctx.input).logout;
      if (!logoutSelector) {
        ctx.skip("No logout selector configured.");
      }

      const session = await ctx.createSession("logout-invalidates-tabs");
      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      const siblingPage = await session.context.newPage();
      await gotoAndWait(
        siblingPage,
        ctx.input.expectations?.protectedUrl ? resolveAbsoluteUrl(ctx.input.url, ctx.input.expectations.protectedUrl) : ctx.input.url,
        ctx.timeoutMs
      );

      await ensureLocatorVisible(session.page, logoutSelector, ctx.timeoutMs, "logout control");
      await session.page.locator(logoutSelector).first().click({ timeout: ctx.timeoutMs });
      await waitForUiToSettle(session.page, ctx.timeoutMs);

      await siblingPage.reload({ waitUntil: "domcontentloaded", timeout: ctx.timeoutMs });
      await waitForUiToSettle(siblingPage, ctx.timeoutMs);
      ctx.assert(
        !(await detectAuthenticatedState(siblingPage, ctx.input, ctx.timeoutMs)),
        "Sibling tab still looked authenticated after logout."
      );
    }),
    await runScenario(suite, "cleared-session-loses-access", "clearing session state removes access", async (ctx) => {
      const session = await ctx.createSession("cleared-session");
      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      await session.context.clearCookies();
      await clearPageStorage(session.page);
      await gotoAndWait(
        session.page,
        ctx.input.expectations?.protectedUrl ? resolveAbsoluteUrl(ctx.input.url, ctx.input.expectations.protectedUrl) : ctx.input.url,
        ctx.timeoutMs
      );

      if (ctx.input.expectations?.protectedUrl) {
        await ctx.assertProtectedRouteBlocked(session);
      } else {
        await ctx.expectAnonymous(session);
      }
    }),
    await runScenario(suite, "browser-restart-behavior", "browser restart persistence matches expectation", async (ctx) => {
      const sessionPersistsAfterBrowserRestart = ctx.input.expectations?.sessionPersistsAfterBrowserRestart;
      if (sessionPersistsAfterBrowserRestart === undefined) {
        ctx.skip("No expectations.sessionPersistsAfterBrowserRestart configured.");
      }

      const session = await ctx.createSession("browser-restart");
      await ctx.loginViaUi(session, credentials, {
        rememberMe: sessionPersistsAfterBrowserRestart
      });
      await ctx.expectAuthenticated(session);

      const storageState = await session.context.storageState();
      const restoredSession = await ctx.createSession("browser-restart-restored", {
        storageState: sessionPersistsAfterBrowserRestart ? storageState : undefined
      });
      await gotoAndWait(
        restoredSession.page,
        ctx.input.expectations?.protectedUrl ? resolveAbsoluteUrl(ctx.input.url, ctx.input.expectations.protectedUrl) : ctx.input.url,
        ctx.timeoutMs
      );

      if (sessionPersistsAfterBrowserRestart) {
        await ctx.expectAuthenticated(restoredSession);
      } else {
        await ctx.expectAnonymous(restoredSession);
      }
    })
  ];
}

async function runLoginMultiuserRealtimeSuite(suite: SuiteContext): Promise<LoginSuiteScenarioResult[]> {
  const credentials = suite.input.credentials;
  const secondaryCredentials = suite.input.secondaryCredentials;
  if (!credentials || !secondaryCredentials) {
    throw new ScenarioAssertionError("login-multiuser-realtime requires credentials and secondaryCredentials.");
  }

  return [
    await runScenario(suite, "two-users-concurrent", "two different users can log in concurrently", async (ctx) => {
      const firstSession = await ctx.createSession("concurrent-user-a");
      const secondSession = await ctx.createSession("concurrent-user-b");

      await Promise.all([
        ctx.loginViaUi(firstSession, credentials),
        ctx.loginViaUi(secondSession, secondaryCredentials)
      ]);

      await Promise.all([ctx.expectAuthenticated(firstSession), ctx.expectAuthenticated(secondSession)]);
    }),
    await runScenario(suite, "same-user-two-contexts", "the same user can authenticate in two isolated contexts", async (ctx) => {
      const firstSession = await ctx.createSession("same-user-a");
      const secondSession = await ctx.createSession("same-user-b");

      await Promise.all([ctx.loginViaUi(firstSession, credentials), ctx.loginViaUi(secondSession, credentials)]);
      await Promise.all([ctx.expectAuthenticated(firstSession), ctx.expectAuthenticated(secondSession)]);
    }),
    await runScenario(suite, "logout-shared-context", "logout in one tab removes access from the sibling tab", async (ctx) => {
      const logoutSelector = resolveSelectors(ctx.input).logout;
      if (!logoutSelector) {
        ctx.skip("No logout selector configured.");
      }

      const session = await ctx.createSession("logout-shared-context");
      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      const siblingPage = await session.context.newPage();
      await gotoAndWait(
        siblingPage,
        ctx.input.expectations?.protectedUrl ? resolveAbsoluteUrl(ctx.input.url, ctx.input.expectations.protectedUrl) : ctx.input.url,
        ctx.timeoutMs
      );

      await session.page.locator(logoutSelector).first().click({ timeout: ctx.timeoutMs });
      await waitForUiToSettle(session.page, ctx.timeoutMs);
      await siblingPage.reload({ waitUntil: "domcontentloaded", timeout: ctx.timeoutMs });
      await waitForUiToSettle(siblingPage, ctx.timeoutMs);

      ctx.assert(
        !(await detectAuthenticatedState(siblingPage, ctx.input, ctx.timeoutMs)),
        "Shared-context sibling tab still appeared authenticated after logout."
      );
    }),
    await runScenario(suite, "websocket-anonymous", "websocket is rejected without authentication", async (ctx) => {
      const realtime = ctx.input.realtime;
      if (!realtime) {
        ctx.skip("No realtime config provided.");
      }
      const realtimeConfig = realtime as NonNullable<LoginSuiteInput["realtime"]>;

      const session = await ctx.createSession("websocket-anonymous");
      await ctx.openLoginPage(session);

      const probe = await probeWebSocket(
        session.page,
        resolveAbsoluteUrl(ctx.input.url, realtimeConfig.wsUrl),
        realtimeConfig.timeoutMs ?? Math.min(ctx.timeoutMs, 4_000)
      );

      if (realtimeConfig.expectUnauthenticatedClose ?? true) {
        ctx.assert(!probe.opened || probe.closed, "Anonymous websocket should be closed or refused.");
      } else {
        ctx.note("Anonymous websocket closure was not strictly required by config.");
      }
    }),
    await runScenario(suite, "websocket-authenticated", "websocket accepts authenticated users", async (ctx) => {
      const realtime = ctx.input.realtime;
      if (!realtime) {
        ctx.skip("No realtime config provided.");
      }
      const realtimeConfig = realtime as NonNullable<LoginSuiteInput["realtime"]>;

      const session = await ctx.createSession("websocket-authenticated");
      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      const probe = await probeWebSocket(
        session.page,
        resolveAbsoluteUrl(ctx.input.url, realtimeConfig.wsUrl),
        realtimeConfig.timeoutMs ?? Math.min(ctx.timeoutMs, 4_000)
      );

      ctx.assert(probe.opened, "Authenticated websocket connection never opened.");
      if (realtimeConfig.expectAuthenticatedMessageIncludes) {
        ctx.assert(
          probe.messages.some((message) => message.includes(realtimeConfig.expectAuthenticatedMessageIncludes ?? "")),
          `Authenticated websocket did not emit a message containing ${realtimeConfig.expectAuthenticatedMessageIncludes}.`
        );
      }
    }),
    await runScenario(suite, "websocket-after-session-loss", "websocket does not stay authenticated after session loss", async (ctx) => {
      const realtime = ctx.input.realtime;
      if (!realtime) {
        ctx.skip("No realtime config provided.");
      }
      const realtimeConfig = realtime as NonNullable<LoginSuiteInput["realtime"]>;

      const session = await ctx.createSession("websocket-after-session-loss");
      await ctx.loginViaUi(session, credentials);
      await ctx.expectAuthenticated(session);

      await session.context.clearCookies();
      await clearPageStorage(session.page);
      await gotoAndWait(session.page, ctx.input.url, ctx.timeoutMs);

      const probe = await probeWebSocket(
        session.page,
        resolveAbsoluteUrl(ctx.input.url, realtimeConfig.wsUrl),
        realtimeConfig.timeoutMs ?? Math.min(ctx.timeoutMs, 4_000)
      );

      ctx.assert(!probe.opened || probe.closed, "Websocket still behaved as authenticated after session removal.");
    })
  ];
}

export async function runLegacyLoginBot(input: LegacyLoginBotInput): Promise<LegacyLoginBotResult> {
  return runSuite("login", input, runLoginSmokeSuite);
}

export async function runLoginBot(input: LegacyLoginBotInput): Promise<LoginBotResult> {
  return runLegacyLoginBot(input);
}

export async function runLoginSmokeBot(input: LoginSmokeBotInput): Promise<LoginSmokeBotResult> {
  return runSuite("login-smoke", input, runLoginSmokeSuite);
}

export async function runLoginValidationBot(input: LoginValidationBotInput): Promise<LoginValidationBotResult> {
  return runSuite("login-validation", input, runLoginValidationSuite);
}

export async function runLoginSecurityBot(input: LoginSecurityBotInput): Promise<LoginSecurityBotResult> {
  return runSuite("login-security", input, runLoginSecuritySuite);
}

export async function runLoginSessionLifecycleBot(
  input: LoginSessionLifecycleBotInput
): Promise<LoginSessionLifecycleBotResult> {
  return runSuite("login-session-lifecycle", input, runLoginSessionLifecycleSuite);
}

export async function runLoginMultiuserRealtimeBot(
  input: LoginMultiuserRealtimeBotInput
): Promise<LoginMultiuserRealtimeBotResult> {
  return runSuite("login-multiuser-realtime", input, runLoginMultiuserRealtimeSuite);
}
