import { resolveTarget } from "../../config/targets";
import { BotInputValidationError } from "../../orchestrator/errors";

export type SmokeBotInput = {
  url: string;
  /** Named target from config/targets.json (and optional targets.local.json). */
  targetId?: string;
  waitForSelector?: string;
  timeoutMs?: number;
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

export function parseSmokeBotInput(input: unknown): SmokeBotInput {
  if (!isObject(input)) {
    throw new BotInputValidationError("Request body must be a JSON object");
  }

  let url = optionalString("url", input.url);
  const targetId = optionalString("targetId", input.targetId);
  let waitForSelector = optionalString("waitForSelector", input.waitForSelector);

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
    waitForSelector = waitForSelector ?? target.waitForSelector;
    timeoutMs = timeoutMs ?? target.timeoutMs;
  }

  if (url === undefined) {
    throw new BotInputValidationError(
      "Provide url or targetId (see config/targets.example.json)"
    );
  }

  return {
    url,
    targetId,
    waitForSelector,
    timeoutMs
  };
}
