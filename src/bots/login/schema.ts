import { BotInputValidationError } from "../../orchestrator/errors";

type JsonPrimitive = string | number | boolean | null;

export type LoginCredential = {
  username: string;
  password: string;
  label?: string;
};

export type LoginSelectors = {
  form?: string;
  username?: string;
  password?: string;
  submit?: string;
  success?: string;
  authState?: string;
  error?: string;
  logout?: string;
  rememberMe?: string;
  loading?: string;
};

export type LoginExpectations = {
  postLoginUrlIncludes?: string;
  protectedUrl?: string;
  unauthorizedUrlIncludes?: string;
  alreadyAuthenticatedUrlIncludes?: string;
  logoutRedirectUrlIncludes?: string;
  sessionPersistsAfterReload?: boolean;
  sessionPersistsAcrossTabs?: boolean;
  sessionPersistsAfterBrowserRestart?: boolean;
  expectedCookieNames?: string[];
  expectedStorageKeys?: string[];
};

export type LoginApiConfig = {
  url: string;
  method?: "POST";
  contentType?: "json" | "form";
  usernameField?: string;
  passwordField?: string;
  headers?: Record<string, string>;
  successStatuses?: number[];
  failureStatuses?: number[];
  extraBody?: Record<string, JsonPrimitive>;
};

export type LoginRealtimeConfig = {
  wsUrl: string;
  expectAuthenticatedMessageIncludes?: string;
  expectUnauthenticatedClose?: boolean;
  timeoutMs?: number;
};

export type LoginArtifactConfig = {
  enabled?: boolean;
  rootDir?: string;
  keepPassingArtifacts?: boolean;
};

export type LoginValidationConfig = {
  identityKind?: "email" | "username";
  longPasswordLength?: number;
  unusualIdentity?: string;
  unusualPassword?: string;
};

export type LoginSecurityConfig = {
  invalidAttemptCount?: number;
  concurrentAttemptCount?: number;
  maskUserEnumeration?: boolean;
};

export type LoginSuiteInput = {
  url: string;
  credentials?: LoginCredential;
  invalidCredentials?: LoginCredential;
  secondaryCredentials?: LoginCredential;
  selectors?: LoginSelectors;
  expectations?: LoginExpectations;
  api?: LoginApiConfig;
  realtime?: LoginRealtimeConfig;
  artifacts?: LoginArtifactConfig;
  validation?: LoginValidationConfig;
  security?: LoginSecurityConfig;
  timeoutMs?: number;
};

export type LegacyLoginBotInput = LoginSuiteInput;
export type LoginSmokeBotInput = LoginSuiteInput & { credentials: LoginCredential };
export type LoginValidationBotInput = LoginSuiteInput;
export type LoginSecurityBotInput = LoginSuiteInput;
export type LoginSessionLifecycleBotInput = LoginSuiteInput & { credentials: LoginCredential };
export type LoginMultiuserRealtimeBotInput = LoginSuiteInput & {
  credentials: LoginCredential;
  secondaryCredentials: LoginCredential;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new BotInputValidationError(`Field ${path} must be an object`);
  }

  return value;
}

function parseRequiredStringField(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new BotInputValidationError(`Missing required field: ${key}`);
  }

  return value;
}

function parseOptionalStringField(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new BotInputValidationError(`Field ${key} must be a string`);
  }

  return value;
}

function parseOptionalBooleanField(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new BotInputValidationError(`Field ${key} must be a boolean`);
  }

  return value;
}

function parseOptionalPositiveIntegerField(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new BotInputValidationError(`Field ${key} must be an integer >= 1`);
  }

  return value;
}

function parseOptionalStringArrayField(input: Record<string, unknown>, key: string): string[] | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new BotInputValidationError(`Field ${key} must be an array of strings`);
  }

  return value;
}

function parseOptionalNumberArrayField(input: Record<string, unknown>, key: string): number[] | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "number" || !Number.isInteger(item))) {
    throw new BotInputValidationError(`Field ${key} must be an array of integers`);
  }

  return value;
}

function parseOptionalStringRecordField(input: Record<string, unknown>, key: string): Record<string, string> | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  const record = asObject(value, key);
  const parsed = Object.entries(record).reduce<Record<string, string>>((accumulator, [recordKey, recordValue]) => {
    if (typeof recordValue !== "string") {
      throw new BotInputValidationError(`Field ${key}.${recordKey} must be a string`);
    }

    accumulator[recordKey] = recordValue;
    return accumulator;
  }, {});

  return parsed;
}

function parseOptionalPrimitiveRecordField(input: Record<string, unknown>, key: string): Record<string, JsonPrimitive> | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  const record = asObject(value, key);
  const parsed = Object.entries(record).reduce<Record<string, JsonPrimitive>>((accumulator, [recordKey, recordValue]) => {
    if (
      recordValue !== null &&
      typeof recordValue !== "string" &&
      typeof recordValue !== "number" &&
      typeof recordValue !== "boolean"
    ) {
      throw new BotInputValidationError(`Field ${key}.${recordKey} must be a string, number, boolean, or null`);
    }

    accumulator[recordKey] = recordValue;
    return accumulator;
  }, {});

  return parsed;
}

function parseOptionalEnumField<TValue extends string>(
  input: Record<string, unknown>,
  key: string,
  allowedValues: readonly TValue[]
): TValue | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !allowedValues.includes(value as TValue)) {
    throw new BotInputValidationError(`Field ${key} must be one of: ${allowedValues.join(", ")}`);
  }

  return value as TValue;
}

function parseCredentialObject(input: Record<string, unknown>, key: string): LoginCredential | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }

  const credential = asObject(value, key);
  const username = parseRequiredStringField(credential, "username");
  const password = parseRequiredStringField(credential, "password");
  const label = parseOptionalStringField(credential, "label");

  return { username, password, label };
}

function parseCredentialPair(
  input: Record<string, unknown>,
  usernameKey: string,
  passwordKey: string,
  label?: string
): LoginCredential | undefined {
  const username = parseOptionalStringField(input, usernameKey);
  const password = parseOptionalStringField(input, passwordKey);

  if ((username === undefined) !== (password === undefined)) {
    throw new BotInputValidationError(`Fields ${usernameKey} and ${passwordKey} must both be provided together`);
  }

  if (username === undefined || password === undefined) {
    return undefined;
  }

  return {
    username,
    password,
    label
  };
}

function parseSelectors(input: Record<string, unknown>): LoginSelectors | undefined {
  const selectorsObject = input.selectors === undefined ? undefined : asObject(input.selectors, "selectors");

  const selectors: LoginSelectors = {
    form: selectorsObject ? parseOptionalStringField(selectorsObject, "form") : undefined,
    username: selectorsObject ? parseOptionalStringField(selectorsObject, "username") : undefined,
    password: selectorsObject ? parseOptionalStringField(selectorsObject, "password") : undefined,
    submit: selectorsObject ? parseOptionalStringField(selectorsObject, "submit") : undefined,
    success: selectorsObject ? parseOptionalStringField(selectorsObject, "success") : undefined,
    authState: selectorsObject ? parseOptionalStringField(selectorsObject, "authState") : undefined,
    error: selectorsObject ? parseOptionalStringField(selectorsObject, "error") : undefined,
    logout: selectorsObject ? parseOptionalStringField(selectorsObject, "logout") : undefined,
    rememberMe: selectorsObject ? parseOptionalStringField(selectorsObject, "rememberMe") : undefined,
    loading: selectorsObject ? parseOptionalStringField(selectorsObject, "loading") : undefined
  };

  selectors.form = parseOptionalStringField(input, "formSelector") ?? selectors.form;
  selectors.username = parseOptionalStringField(input, "usernameSelector") ?? selectors.username;
  selectors.password = parseOptionalStringField(input, "passwordSelector") ?? selectors.password;
  selectors.submit = parseOptionalStringField(input, "submitSelector") ?? selectors.submit;
  selectors.success = parseOptionalStringField(input, "successSelector") ?? selectors.success;
  selectors.authState = parseOptionalStringField(input, "authStateSelector") ?? selectors.authState;
  selectors.error = parseOptionalStringField(input, "errorSelector") ?? selectors.error;
  selectors.logout = parseOptionalStringField(input, "logoutSelector") ?? selectors.logout;
  selectors.rememberMe = parseOptionalStringField(input, "rememberMeSelector") ?? selectors.rememberMe;
  selectors.loading = parseOptionalStringField(input, "loadingSelector") ?? selectors.loading;

  return Object.values(selectors).some((value) => value !== undefined) ? selectors : undefined;
}

function parseExpectations(input: Record<string, unknown>): LoginExpectations | undefined {
  const expectationsObject = input.expectations === undefined ? undefined : asObject(input.expectations, "expectations");

  const expectations: LoginExpectations = {
    postLoginUrlIncludes: expectationsObject ? parseOptionalStringField(expectationsObject, "postLoginUrlIncludes") : undefined,
    protectedUrl: expectationsObject ? parseOptionalStringField(expectationsObject, "protectedUrl") : undefined,
    unauthorizedUrlIncludes: expectationsObject ? parseOptionalStringField(expectationsObject, "unauthorizedUrlIncludes") : undefined,
    alreadyAuthenticatedUrlIncludes: expectationsObject
      ? parseOptionalStringField(expectationsObject, "alreadyAuthenticatedUrlIncludes")
      : undefined,
    logoutRedirectUrlIncludes: expectationsObject
      ? parseOptionalStringField(expectationsObject, "logoutRedirectUrlIncludes")
      : undefined,
    sessionPersistsAfterReload: expectationsObject
      ? parseOptionalBooleanField(expectationsObject, "sessionPersistsAfterReload")
      : undefined,
    sessionPersistsAcrossTabs: expectationsObject
      ? parseOptionalBooleanField(expectationsObject, "sessionPersistsAcrossTabs")
      : undefined,
    sessionPersistsAfterBrowserRestart: expectationsObject
      ? parseOptionalBooleanField(expectationsObject, "sessionPersistsAfterBrowserRestart")
      : undefined,
    expectedCookieNames: expectationsObject ? parseOptionalStringArrayField(expectationsObject, "expectedCookieNames") : undefined,
    expectedStorageKeys: expectationsObject ? parseOptionalStringArrayField(expectationsObject, "expectedStorageKeys") : undefined
  };

  expectations.protectedUrl = parseOptionalStringField(input, "protectedUrl") ?? expectations.protectedUrl;
  expectations.postLoginUrlIncludes = parseOptionalStringField(input, "postLoginUrlIncludes") ?? expectations.postLoginUrlIncludes;
  expectations.unauthorizedUrlIncludes =
    parseOptionalStringField(input, "unauthorizedUrlIncludes") ?? expectations.unauthorizedUrlIncludes;

  return Object.values(expectations).some((value) => value !== undefined) ? expectations : undefined;
}

function parseApiConfig(input: Record<string, unknown>): LoginApiConfig | undefined {
  if (input.api === undefined) {
    return undefined;
  }

  const api = asObject(input.api, "api");

  return {
    url: parseRequiredStringField(api, "url"),
    method: parseOptionalEnumField(api, "method", ["POST"] as const),
    contentType: parseOptionalEnumField(api, "contentType", ["json", "form"] as const),
    usernameField: parseOptionalStringField(api, "usernameField"),
    passwordField: parseOptionalStringField(api, "passwordField"),
    headers: parseOptionalStringRecordField(api, "headers"),
    successStatuses: parseOptionalNumberArrayField(api, "successStatuses"),
    failureStatuses: parseOptionalNumberArrayField(api, "failureStatuses"),
    extraBody: parseOptionalPrimitiveRecordField(api, "extraBody")
  };
}

function parseRealtimeConfig(input: Record<string, unknown>): LoginRealtimeConfig | undefined {
  if (input.realtime === undefined) {
    return undefined;
  }

  const realtime = asObject(input.realtime, "realtime");

  return {
    wsUrl: parseRequiredStringField(realtime, "wsUrl"),
    expectAuthenticatedMessageIncludes: parseOptionalStringField(realtime, "expectAuthenticatedMessageIncludes"),
    expectUnauthenticatedClose: parseOptionalBooleanField(realtime, "expectUnauthenticatedClose"),
    timeoutMs: parseOptionalPositiveIntegerField(realtime, "timeoutMs")
  };
}

function parseArtifactConfig(input: Record<string, unknown>): LoginArtifactConfig | undefined {
  if (input.artifacts === undefined) {
    return undefined;
  }

  const artifacts = asObject(input.artifacts, "artifacts");

  return {
    enabled: parseOptionalBooleanField(artifacts, "enabled"),
    rootDir: parseOptionalStringField(artifacts, "rootDir"),
    keepPassingArtifacts: parseOptionalBooleanField(artifacts, "keepPassingArtifacts")
  };
}

function parseValidationConfig(input: Record<string, unknown>): LoginValidationConfig | undefined {
  if (input.validation === undefined) {
    return undefined;
  }

  const validation = asObject(input.validation, "validation");

  return {
    identityKind: parseOptionalEnumField(validation, "identityKind", ["email", "username"] as const),
    longPasswordLength: parseOptionalPositiveIntegerField(validation, "longPasswordLength"),
    unusualIdentity: parseOptionalStringField(validation, "unusualIdentity"),
    unusualPassword: parseOptionalStringField(validation, "unusualPassword")
  };
}

function parseSecurityConfig(input: Record<string, unknown>): LoginSecurityConfig | undefined {
  if (input.security === undefined) {
    return undefined;
  }

  const security = asObject(input.security, "security");

  return {
    invalidAttemptCount: parseOptionalPositiveIntegerField(security, "invalidAttemptCount"),
    concurrentAttemptCount: parseOptionalPositiveIntegerField(security, "concurrentAttemptCount"),
    maskUserEnumeration: parseOptionalBooleanField(security, "maskUserEnumeration")
  };
}

function parseCommonLoginSuiteInput(input: unknown): LoginSuiteInput {
  if (!isObject(input)) {
    throw new BotInputValidationError("Request body must be a JSON object");
  }

  const url = parseRequiredStringField(input, "url");
  const credentials = parseCredentialObject(input, "credentials") ?? parseCredentialPair(input, "username", "password", "primary");
  const invalidCredentials =
    parseCredentialObject(input, "invalidCredentials") ??
    parseCredentialPair(input, "invalidUsername", "invalidPassword", "invalid");
  const secondaryCredentials =
    parseCredentialObject(input, "secondaryCredentials") ??
    parseCredentialPair(input, "secondaryUsername", "secondaryPassword", "secondary");

  return {
    url,
    credentials,
    invalidCredentials,
    secondaryCredentials,
    selectors: parseSelectors(input),
    expectations: parseExpectations(input),
    api: parseApiConfig(input),
    realtime: parseRealtimeConfig(input),
    artifacts: parseArtifactConfig(input),
    validation: parseValidationConfig(input),
    security: parseSecurityConfig(input),
    timeoutMs: parseOptionalPositiveIntegerField(input, "timeoutMs")
  };
}

function assertCredentialsPresent(input: LoginSuiteInput, suiteId: string): asserts input is LoginSuiteInput & { credentials: LoginCredential } {
  if (!input.credentials) {
    throw new BotInputValidationError(
      `Bot ${suiteId} requires credentials. Provide credentials.username/password or username/password.`
    );
  }
}

function assertSecondaryCredentialsPresent(
  input: LoginSuiteInput,
  suiteId: string
): asserts input is LoginSuiteInput & { credentials: LoginCredential; secondaryCredentials: LoginCredential } {
  assertCredentialsPresent(input, suiteId);

  if (!input.secondaryCredentials) {
    throw new BotInputValidationError(
      `Bot ${suiteId} requires secondaryCredentials.username/password or secondaryUsername/secondaryPassword.`
    );
  }
}

export function parseLegacyLoginBotInput(input: unknown): LegacyLoginBotInput {
  return parseCommonLoginSuiteInput(input);
}

export function parseLoginBotInput(input: unknown): LegacyLoginBotInput {
  return parseLegacyLoginBotInput(input);
}

export function parseLoginSmokeBotInput(input: unknown): LoginSmokeBotInput {
  const parsed = parseCommonLoginSuiteInput(input);
  assertCredentialsPresent(parsed, "login-smoke");
  return parsed;
}

export function parseLoginValidationBotInput(input: unknown): LoginValidationBotInput {
  return parseCommonLoginSuiteInput(input);
}

export function parseLoginSecurityBotInput(input: unknown): LoginSecurityBotInput {
  return parseCommonLoginSuiteInput(input);
}

export function parseLoginSessionLifecycleBotInput(input: unknown): LoginSessionLifecycleBotInput {
  const parsed = parseCommonLoginSuiteInput(input);
  assertCredentialsPresent(parsed, "login-session-lifecycle");
  return parsed;
}

export function parseLoginMultiuserRealtimeBotInput(input: unknown): LoginMultiuserRealtimeBotInput {
  const parsed = parseCommonLoginSuiteInput(input);
  assertSecondaryCredentialsPresent(parsed, "login-multiuser-realtime");
  return parsed;
}
