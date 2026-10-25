import { BotInputValidationError } from "../../orchestrator/errors";

export type FormXssBotInput = {
  /** Target page URL. Omit (or set calibrateOnly) to run mutant calibration only. */
  url?: string;
  formSelector?: string;
  fieldSelector?: string;
  submitSelector?: string;
  timeoutMs?: number;
  /** When true, skip the target and only calibrate against mutants. */
  calibrateOnly?: boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(field: string, value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new BotInputValidationError(`Field ${field} must be a non-empty string`);
  }
  return value;
}

export function parseFormXssBotInput(input: unknown): FormXssBotInput {
  if (!isObject(input)) {
    throw new BotInputValidationError("Request body must be a JSON object");
  }

  const url = optionalString("url", input.url);
  const formSelector = optionalString("formSelector", input.formSelector);
  const fieldSelector = optionalString("fieldSelector", input.fieldSelector);
  const submitSelector = optionalString("submitSelector", input.submitSelector);

  const timeoutMs = input.timeoutMs;
  if (timeoutMs !== undefined) {
    if (typeof timeoutMs !== "number" || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
      throw new BotInputValidationError("Field timeoutMs must be an integer >= 1");
    }
  }

  const calibrateOnly = input.calibrateOnly;
  if (calibrateOnly !== undefined && typeof calibrateOnly !== "boolean") {
    throw new BotInputValidationError("Field calibrateOnly must be a boolean");
  }

  if (!calibrateOnly && url === undefined) {
    throw new BotInputValidationError("Missing required field: url (or set calibrateOnly: true)");
  }

  return {
    url,
    formSelector,
    fieldSelector,
    submitSelector,
    timeoutMs,
    calibrateOnly
  };
}
