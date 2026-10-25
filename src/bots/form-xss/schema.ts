import { resolveTarget } from "../../config/targets";
import { BotInputValidationError } from "../../orchestrator/errors";

export type FormXssBotInput = {
  /** Target page URL. Omit when using targetId or calibrateOnly. */
  url?: string;
  /** Named target from config/targets.json (and optional targets.local.json). */
  targetId?: string;
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

  const calibrateOnly = input.calibrateOnly;
  if (calibrateOnly !== undefined && typeof calibrateOnly !== "boolean") {
    throw new BotInputValidationError("Field calibrateOnly must be a boolean");
  }

  let url = optionalString("url", input.url);
  const targetId = optionalString("targetId", input.targetId);
  let formSelector = optionalString("formSelector", input.formSelector);
  let fieldSelector = optionalString("fieldSelector", input.fieldSelector);
  let submitSelector = optionalString("submitSelector", input.submitSelector);

  let timeoutMs: number | undefined;
  if (input.timeoutMs !== undefined) {
    if (typeof input.timeoutMs !== "number" || !Number.isInteger(input.timeoutMs) || input.timeoutMs < 1) {
      throw new BotInputValidationError("Field timeoutMs must be an integer >= 1");
    }
    timeoutMs = input.timeoutMs;
  }

  if (targetId) {
    const target = resolveTarget(targetId);
    url = url ?? target.url;
    formSelector = formSelector ?? target.formSelector;
    fieldSelector = fieldSelector ?? target.fieldSelector;
    submitSelector = submitSelector ?? target.submitSelector;
    timeoutMs = timeoutMs ?? target.timeoutMs;
  }

  if (!calibrateOnly && url === undefined) {
    throw new BotInputValidationError(
      "Provide url, targetId, or set calibrateOnly: true (see config/targets.example.json)"
    );
  }

  return {
    url,
    targetId,
    formSelector,
    fieldSelector,
    submitSelector,
    timeoutMs,
    calibrateOnly
  };
}
