import { writeArtifact } from "../lib/artifacts";
import type { BotRunReport } from "../findings/types";
import { BotInputValidationError } from "./errors";
import { getBotById, listBotDefinitions } from "./registry";

export type SuiteInput = {
  targetId?: string;
  url?: string;
  botIds?: string[];
  calibrateOnly?: boolean;
  writeArtifact?: boolean;
  timeoutMs?: number;
};

export type SuiteResult = {
  ok: boolean;
  reports: BotRunReport[];
  artifactPath?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseSuiteInput(input: unknown): SuiteInput {
  if (!isObject(input)) {
    throw new BotInputValidationError("Request body must be a JSON object");
  }

  const targetId = input.targetId;
  if (targetId !== undefined && (typeof targetId !== "string" || targetId.trim() === "")) {
    throw new BotInputValidationError("Field targetId must be a non-empty string");
  }

  const url = input.url;
  if (url !== undefined && (typeof url !== "string" || url.trim() === "")) {
    throw new BotInputValidationError("Field url must be a non-empty string");
  }

  let botIds: string[] | undefined;
  if (input.botIds !== undefined) {
    if (!Array.isArray(input.botIds) || !input.botIds.every((id) => typeof id === "string")) {
      throw new BotInputValidationError("Field botIds must be an array of strings");
    }
    botIds = input.botIds as string[];
  }

  if (input.calibrateOnly !== undefined && typeof input.calibrateOnly !== "boolean") {
    throw new BotInputValidationError("Field calibrateOnly must be a boolean");
  }
  if (input.writeArtifact !== undefined && typeof input.writeArtifact !== "boolean") {
    throw new BotInputValidationError("Field writeArtifact must be a boolean");
  }
  if (input.timeoutMs !== undefined) {
    if (typeof input.timeoutMs !== "number" || !Number.isInteger(input.timeoutMs) || input.timeoutMs < 1) {
      throw new BotInputValidationError("Field timeoutMs must be an integer >= 1");
    }
  }

  if (!input.calibrateOnly && targetId === undefined && url === undefined) {
    throw new BotInputValidationError("Provide targetId, url, or calibrateOnly: true");
  }

  return {
    targetId: targetId as string | undefined,
    url: url as string | undefined,
    botIds,
    calibrateOnly: input.calibrateOnly as boolean | undefined,
    writeArtifact: input.writeArtifact as boolean | undefined,
    timeoutMs: input.timeoutMs as number | undefined
  };
}

function asReport(botId: string, raw: unknown): BotRunReport {
  const r = raw as Partial<BotRunReport>;
  return {
    botId,
    targetId: r.targetId,
    probeTrusted: Boolean(r.probeTrusted),
    calibrations: Array.isArray(r.calibrations) ? r.calibrations : [],
    findings: Array.isArray(r.findings) ? r.findings : [],
    suppressed: Array.isArray(r.suppressed) ? r.suppressed : [],
    artifactPath: r.artifactPath
  };
}

/** Calibrate/run selected security bots for one target; write optional artifact. */
export async function runSuite(input: SuiteInput): Promise<SuiteResult> {
  const securityBots =
    input.botIds && input.botIds.length > 0
      ? input.botIds
      : listBotDefinitions()
          .map((b) => b.id)
          .filter((id) => id !== "smoke");

  const reports: BotRunReport[] = [];

  for (const botId of securityBots) {
    const bot = getBotById(botId);
    if (!bot) {
      throw new BotInputValidationError(`Unknown bot id in suite: ${botId}`);
    }

    const body: Record<string, unknown> = {
      targetId: input.targetId,
      url: input.url,
      calibrateOnly: input.calibrateOnly,
      writeArtifact: false,
      timeoutMs: input.timeoutMs
    };

    const parsed = bot.parseInput(body);
    const raw = await bot.run(parsed);
    reports.push(asReport(botId, raw));
  }

  const result: SuiteResult = {
    ok: reports.every((r) => r.probeTrusted),
    reports
  };

  if (input.writeArtifact) {
    result.artifactPath = writeArtifact(`suite-${input.targetId ?? "calibrate"}`, result);
  }

  return result;
}
