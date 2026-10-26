import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { TargetAuthConfig } from "../lib/auth";
import { fixtureFileUrl } from "../mutants/catalog";
import { BotInputValidationError } from "../orchestrator/errors";

export type TargetEntry = {
  url: string;
  description?: string;
  formSelector?: string;
  fieldSelector?: string;
  submitSelector?: string;
  waitForSelector?: string;
  timeoutMs?: number;
  auth?: TargetAuthConfig;
};

export type TargetsFile = {
  defaults?: {
    timeoutMs?: number;
  };
  targets: Record<string, TargetEntry>;
};

export type ResolvedTarget = TargetEntry & {
  id: string;
  timeoutMs?: number;
};

const DEFAULT_RELATIVE_PATH = "config/targets.json";
const LOCAL_OVERRIDE_PATH = "config/targets.local.json";

function projectPath(relative: string): string {
  return join(process.cwd(), relative);
}

function resolveConfigPath(): string {
  const fromEnv = process.env.MONKEY_BOT_TARGETS_FILE;
  if (fromEnv && fromEnv.trim() !== "") {
    return isAbsolute(fromEnv) ? fromEnv : projectPath(fromEnv);
  }
  return projectPath(DEFAULT_RELATIVE_PATH);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(field: string, value: unknown, id: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new BotInputValidationError(`Target "${id}" field ${field} must be a non-empty string`);
  }
  return value;
}

function parseAuth(id: string, value: unknown): TargetAuthConfig | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isObject(value)) {
    throw new BotInputValidationError(`Target "${id}" auth must be an object`);
  }

  const requireField = (field: string): string => {
    const v = value[field];
    if (typeof v !== "string" || v.trim() === "") {
      throw new BotInputValidationError(`Target "${id}" auth.${field} must be a non-empty string`);
    }
    return v;
  };

  let timeoutMs: number | undefined;
  if (value.timeoutMs !== undefined) {
    if (typeof value.timeoutMs !== "number" || !Number.isInteger(value.timeoutMs) || value.timeoutMs < 1) {
      throw new BotInputValidationError(`Target "${id}" auth.timeoutMs must be an integer >= 1`);
    }
    timeoutMs = value.timeoutMs;
  }

  return {
    loginUrl: requireField("loginUrl"),
    usernameSelector: requireField("usernameSelector"),
    passwordSelector: requireField("passwordSelector"),
    submitSelector: requireField("submitSelector"),
    usernameEnv: requireField("usernameEnv"),
    passwordEnv: requireField("passwordEnv"),
    storageStatePath: optionalString("storageStatePath", value.storageStatePath, id),
    timeoutMs
  };
}

function parseTargetEntry(id: string, value: unknown): TargetEntry {
  if (!isObject(value)) {
    throw new BotInputValidationError(`Target "${id}" must be an object`);
  }

  const rawUrl = value.url;
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    throw new BotInputValidationError(`Target "${id}" is missing a non-empty url`);
  }
  let url: string = rawUrl;
  // mutant:<file.html> resolves to a local seeded fixture (baseline / lab targets)
  if (url.startsWith("mutant:")) {
    const fileName = url.slice("mutant:".length);
    if (!/^[a-zA-Z0-9._-]+\.html$/.test(fileName)) {
      throw new BotInputValidationError(`Target "${id}" has invalid mutant fixture name`);
    }
    url = fixtureFileUrl(fileName);
  }

  let timeoutMs: number | undefined;
  if (value.timeoutMs !== undefined) {
    if (typeof value.timeoutMs !== "number" || !Number.isInteger(value.timeoutMs) || value.timeoutMs < 1) {
      throw new BotInputValidationError(`Target "${id}" field timeoutMs must be an integer >= 1`);
    }
    timeoutMs = value.timeoutMs;
  }

  return {
    url,
    description: optionalString("description", value.description, id),
    formSelector: optionalString("formSelector", value.formSelector, id),
    fieldSelector: optionalString("fieldSelector", value.fieldSelector, id),
    submitSelector: optionalString("submitSelector", value.submitSelector, id),
    waitForSelector: optionalString("waitForSelector", value.waitForSelector, id),
    timeoutMs,
    auth: parseAuth(id, value.auth)
  };
}

function parseTargetsFile(raw: unknown, source: string): TargetsFile {
  if (!isObject(raw)) {
    throw new BotInputValidationError(`Targets config must be a JSON object (${source})`);
  }

  const targetsRaw = raw.targets;
  if (!isObject(targetsRaw)) {
    throw new BotInputValidationError(`Targets config missing "targets" object (${source})`);
  }

  const targets: Record<string, TargetEntry> = {};
  for (const [id, entry] of Object.entries(targetsRaw)) {
    targets[id] = parseTargetEntry(id, entry);
  }

  let defaults: TargetsFile["defaults"];
  if (raw.defaults !== undefined) {
    if (!isObject(raw.defaults)) {
      throw new BotInputValidationError(`Targets config "defaults" must be an object (${source})`);
    }
    if (raw.defaults.timeoutMs !== undefined) {
      const t = raw.defaults.timeoutMs;
      if (typeof t !== "number" || !Number.isInteger(t) || t < 1) {
        throw new BotInputValidationError(`Targets defaults.timeoutMs must be an integer >= 1 (${source})`);
      }
      defaults = { timeoutMs: t };
    } else {
      defaults = {};
    }
  }

  return { defaults, targets };
}

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    throw new BotInputValidationError(`Failed to read targets config at ${path}: ${message}`);
  }
}

function mergeTargets(base: TargetsFile, overlay: TargetsFile): TargetsFile {
  return {
    defaults: {
      ...base.defaults,
      ...overlay.defaults
    },
    targets: {
      ...base.targets,
      ...overlay.targets
    }
  };
}

/** Load committed targets.json plus optional targets.local.json overrides. */
export function loadTargetsFile(): TargetsFile {
  const primaryPath = resolveConfigPath();
  if (!existsSync(primaryPath)) {
    throw new BotInputValidationError(
      `Targets config not found at ${primaryPath}. Copy config/targets.example.json to config/targets.json`
    );
  }

  let file = parseTargetsFile(readJsonFile(primaryPath), primaryPath);

  const localPath = projectPath(LOCAL_OVERRIDE_PATH);
  if (!process.env.MONKEY_BOT_TARGETS_FILE && existsSync(localPath)) {
    const local = parseTargetsFile(readJsonFile(localPath), localPath);
    file = mergeTargets(file, local);
  }

  return file;
}

export function listTargetSummaries(): Array<{ id: string; url: string; description?: string }> {
  const file = loadTargetsFile();
  return Object.entries(file.targets).map(([id, entry]) => ({
    id,
    url: entry.url,
    description: entry.description
  }));
}

export function resolveTarget(targetId: string): ResolvedTarget {
  const file = loadTargetsFile();
  const entry = file.targets[targetId];
  if (!entry) {
    const known = Object.keys(file.targets).sort().join(", ") || "(none)";
    throw new BotInputValidationError(`Unknown targetId "${targetId}". Known targets: ${known}`);
  }

  return {
    id: targetId,
    ...entry,
    timeoutMs: entry.timeoutMs ?? file.defaults?.timeoutMs
  };
}
