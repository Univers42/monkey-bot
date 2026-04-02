import { BotInputValidationError } from "../../orchestrator/errors";

export type SmokeBotInput = {
  url: string;
  waitForSelector?: string;
  timeoutMs?: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseSmokeBotInput(input: unknown): SmokeBotInput {
  if (!isObject(input)) {
    throw new BotInputValidationError("Request body must be a JSON object");
  }

  const url = input.url;
  if (typeof url !== "string" || url.trim() === "") {
    throw new BotInputValidationError("Missing required field: url");
  }

  const waitForSelector = input.waitForSelector;
  if (waitForSelector !== undefined && typeof waitForSelector !== "string") {
    throw new BotInputValidationError("Field waitForSelector must be a string");
  }

  const timeoutMs = input.timeoutMs;
  if (timeoutMs !== undefined) {
    if (typeof timeoutMs !== "number" || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
      throw new BotInputValidationError("Field timeoutMs must be an integer >= 1");
    }
  }

  return {
    url,
    waitForSelector,
    timeoutMs
  };
}
