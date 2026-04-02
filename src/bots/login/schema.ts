import { BotInputValidationError } from "../../orchestrator/errors";

export type LoginBotInput = {
  url: string;
  username?: string;
  password?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  successSelector?: string;
  timeoutMs?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

export function parseLoginBotInput(input: unknown): LoginBotInput {
  if (!isObject(input)) {
    throw new BotInputValidationError("Request body must be a JSON object");
  }

  const url = input.url;
  if (typeof url !== "string" || url.trim() === "") {
    throw new BotInputValidationError("Missing required field: url");
  }

  const username = parseOptionalStringField(input, "username");
  const password = parseOptionalStringField(input, "password");
  const usernameSelector = parseOptionalStringField(input, "usernameSelector");
  const passwordSelector = parseOptionalStringField(input, "passwordSelector");
  const submitSelector = parseOptionalStringField(input, "submitSelector");
  const successSelector = parseOptionalStringField(input, "successSelector");

  if ((username === undefined) !== (password === undefined)) {
    throw new BotInputValidationError("Fields username and password must both be provided together");
  }

  const timeoutMs = input.timeoutMs;
  if (timeoutMs !== undefined) {
    if (typeof timeoutMs !== "number" || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
      throw new BotInputValidationError("Field timeoutMs must be an integer >= 1");
    }
  }

  return {
    url,
    username,
    password,
    usernameSelector,
    passwordSelector,
    submitSelector,
    successSelector,
    timeoutMs
  };
}
