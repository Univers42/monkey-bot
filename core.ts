import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { BrowserHarness } from "./browser.ts";

export type ConcurrencyMode = "isolated" | "coordinated" | "conflict" | "swarm";
export type ReporterId = "terminal" | "json" | "junit" | "html";
export type ScenarioStatus = "passed" | "failed" | "skipped";
export type ResultEnvelopeStatus = ScenarioStatus | "running";
type MaybePromise<TValue> = TValue | Promise<TValue>;

export type CliFlags = {
  project?: string;
  env?: string;
  suite?: string;
  scenario?: string;
  tag?: string[];
  concurrency?: ConcurrencyMode;
  workers: number;
  actors?: number;
  headed: boolean;
  debug: boolean;
  keepArtifacts: boolean;
  retries: number;
  output?: string;
  reporter: ReporterId[];
  grep?: string;
  seed?: string;
};

export type ActorDefinition = {
  id: string;
  role: string;
  userKey?: string;
  capabilities?: string[];
  resources?: string[];
};

export type ResultEnvelope = {
  actorId?: string;
  phase?: string;
  title: string;
  status: ResultEnvelopeStatus;
  durationMs: number;
  error?: string;
  resource?: string;
};

export type AssertionRecord = {
  ok: boolean;
  message: string;
  actorId?: string;
  phase?: string;
  expected?: unknown;
  actual?: unknown;
};

export type ExecutionSummary = {
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
};

export type ScenarioResult = {
  id: string;
  title: string;
  suite: string;
  tags: string[];
  concurrency: ConcurrencyMode;
  status: ScenarioStatus;
  flaky: boolean;
  attempts: number;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
  actors: ActorDefinition[];
  resources: string[];
  artifacts: string[];
  finalUrls: Record<string, string>;
  phaseTimings: Record<string, number>;
  assertions: AssertionRecord[];
  envelopes: ResultEnvelope[];
  errors: string[];
  notes: string[];
  consoleErrors: string[];
  failedRequests: string[];
  httpObservations: Array<{ actorId: string; method: string; url: string; status: number; bodyPreview?: string }>;
};

export type RunResult = {
  project: string;
  env: string;
  runId: string;
  suite?: string;
  scenario?: string;
  concurrency?: ConcurrencyMode;
  workers: number;
  actors?: number;
  retries: number;
  seed?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: ExecutionSummary;
  scenarios: ScenarioResult[];
  reportDir: string;
  latestDir: string;
  artifactsRoot: string;
};

export type ExecutionContext = {
  runId: string;
  project: string;
  env: string;
  flags: CliFlags;
  reportDir: string;
  latestDir: string;
  artifactsRoot: string;
};

export type ReporterHooks = {
  onRunStart?(run: ExecutionContext, scenarios: Array<{ id: string; title: string }>): void;
  onScenarioStart?(run: ExecutionContext, scenario: { id: string; title: string }): void;
  onScenarioComplete?(run: ExecutionContext, result: ScenarioResult): void;
  onRunComplete?(result: RunResult): void;
};

export type DoctorCheck = {
  name: string;
  ok: boolean;
  details: string;
};

export type ProjectDefinition<TProject> = {
  name: string;
  description: string;
  create(env: string, flags: CliFlags, execution: ExecutionContext): MaybePromise<ProjectRuntime<TProject>>;
};

export type ProjectRuntime<TProject> = {
  name: string;
  description: string;
  config: {
    baseUrl: string;
    featureFlags: Record<string, boolean>;
    selectors: Record<string, Record<string, string>>;
    routes: Record<string, string>;
  };
  adapter: TProject;
  scenarios: ScenarioDefinition<TProject>[];
  doctor?(execution: ExecutionContext): Promise<DoctorCheck[]>;
};

export type ScenarioDefinition<TProject> = {
  id: string;
  title: string;
  suite: string;
  tags: string[];
  concurrency: ConcurrencyMode[];
  defaultConcurrency: ConcurrencyMode;
  actors: ActorDefinition[];
  preconditions?: (ctx: ScenarioContext<TProject>) => MaybePromise<void>;
  execute: (ctx: ScenarioContext<TProject>) => Promise<void>;
  verify?: (ctx: ScenarioContext<TProject>) => MaybePromise<void>;
  cleanup?: (ctx: ScenarioContext<TProject>) => MaybePromise<void>;
};

type ScenarioRuntime<TProject> = {
  definition: ScenarioDefinition<TProject>;
  execution: ExecutionContext;
  project: ProjectRuntime<TProject>;
  concurrency: ConcurrencyMode;
  scenarioDir: string;
  harness: BrowserHarness;
};

export class ScenarioSkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScenarioSkipError";
  }
}

export class PhaseBarrier {
  private readonly arrivals = new Map<string, Set<string>>();
  private readonly waiters = new Map<string, Array<() => void>>();
  private readonly actorIds: string[];

  constructor(actorIds: string[]) {
    this.actorIds = actorIds;
  }

  async wait(phase: string, actorId: string): Promise<void> {
    const phaseActors = this.arrivals.get(phase) ?? new Set<string>();
    phaseActors.add(actorId);
    this.arrivals.set(phase, phaseActors);

    if (phaseActors.size >= this.actorIds.length) {
      const waiters = this.waiters.get(phase) ?? [];
      for (const release of waiters) {
        release();
      }
      this.waiters.delete(phase);
      return;
    }

    await new Promise<void>((resolveWait) => {
      const waiters = this.waiters.get(phase) ?? [];
      waiters.push(resolveWait);
      this.waiters.set(phase, waiters);
    });
  }
}

export type ScenarioContext<TProject> = {
  execution: ExecutionContext;
  project: ProjectRuntime<TProject>;
  scenario: ScenarioDefinition<TProject>;
  concurrency: ConcurrencyMode;
  scenarioDir: string;
  state: Map<string, unknown>;
  notes: string[];
  barrier(name?: string): PhaseBarrier;
  actor(id: string): Promise<Awaited<ReturnType<BrowserHarness["actor"]>>>;
  phase<T>(actorId: string, phase: string, title: string, task: () => Promise<T>, resource?: string): Promise<T>;
  expect(condition: unknown, message: string, details?: Omit<AssertionRecord, "ok" | "message">): void;
  skip(message: string): never;
  note(message: string): void;
  set<TValue>(key: string, value: TValue): TValue;
  get<TValue>(key: string): TValue | undefined;
  resource(prefix: string): string;
  artifact(path: string): void;
};

function outputBase(kind: "reports" | "artifacts"): string {
  const envKey = kind === "reports" ? "REPORTS_DIR" : "ARTIFACTS_DIR";
  return resolve(process.cwd(), process.env[envKey] ?? kind);
}

export function createRunId(seed?: string): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const tail = Math.random().toString(36).slice(2, 7);
  return `qa-run-${stamp}-${seed ? `${slugify(seed)}-` : ""}${tail}`;
}

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

export function selectScenarios<TProject>(
  runtime: ProjectRuntime<TProject>,
  flags: CliFlags
): ScenarioDefinition<TProject>[] {
  const tagSet = new Set(flags.tag ?? []);
  const grep = flags.grep ? new RegExp(flags.grep, "i") : undefined;

  return runtime.scenarios.filter((scenario) => {
    if (flags.scenario && scenario.id !== flags.scenario) {
      return false;
    }
    if (flags.suite && scenario.suite !== flags.suite && !scenario.tags.includes(`suite:${flags.suite}`)) {
      return false;
    }
    if (tagSet.size > 0 && !scenario.tags.some((tag) => tagSet.has(tag))) {
      return false;
    }
    if (grep && !grep.test(`${scenario.id} ${scenario.title} ${scenario.tags.join(" ")}`)) {
      return false;
    }
    return true;
  });
}

export function validateScenarioSelection<TProject>(
  runtime: ProjectRuntime<TProject>,
  scenarios: ScenarioDefinition<TProject>[],
  flags: CliFlags
): void {
  if (!flags.project) {
    throw new Error("Missing required flag: --project");
  }
  if (!flags.scenario && !flags.suite) {
    throw new Error("Use either --scenario or --suite.");
  }
  if (flags.scenario && flags.suite) {
    throw new Error("Use either --scenario or --suite, not both.");
  }
  if (scenarios.length === 0) {
    throw new Error(`No scenarios matched the selection for project ${runtime.name}.`);
  }
  if (flags.concurrency === "swarm") {
    throw new Error("Concurrency mode swarm is reserved for a future high-concurrency module.");
  }
  if (flags.concurrency) {
    for (const scenario of scenarios) {
      if (!scenario.concurrency.includes(flags.concurrency)) {
        throw new Error(`Scenario ${scenario.id} does not support concurrency ${flags.concurrency}.`);
      }
    }
  }
}

export async function createExecutionContext(project: string, env: string, flags: CliFlags): Promise<ExecutionContext> {
  const runId = createRunId(flags.seed);
  const reportDir = resolve(outputBase("reports"), project, runId);
  const latestDir = resolve(outputBase("reports"), project, "latest");
  const artifactsRoot = resolve(outputBase("artifacts"), project, runId);

  await Promise.all([
    mkdir(reportDir, { recursive: true }),
    mkdir(latestDir, { recursive: true }),
    mkdir(artifactsRoot, { recursive: true })
  ]);

  return {
    runId,
    project,
    env,
    flags,
    reportDir,
    latestDir,
    artifactsRoot
  };
}

async function runWithLimit<TValue>(items: TValue[], limit: number, task: (item: TValue) => Promise<void>): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) {
        return;
      }
      await task(item);
    }
  });

  await Promise.all(workers);
}

function emptySummary(): ExecutionSummary {
  return { passed: 0, failed: 0, skipped: 0, flaky: 0 };
}

function buildSummary(results: ScenarioResult[]): ExecutionSummary {
  return results.reduce((summary, scenario) => {
    summary[scenario.status] += 1;
    if (scenario.flaky) {
      summary.flaky += 1;
    }
    return summary;
  }, emptySummary());
}

async function runScenarioAttempt<TProject>(runtime: ScenarioRuntime<TProject>): Promise<ScenarioResult> {
  const startedAt = new Date();
  const notes: string[] = [];
  const assertions: AssertionRecord[] = [];
  const envelopes: ResultEnvelope[] = [];
  const errors: string[] = [];
  const resources: string[] = [];
  const artifacts = new Set<string>();
  const barriers = new Map<string, PhaseBarrier>();
  const state = new Map<string, unknown>();
  const phaseTimings = new Map<string, number>();

  const ctx: ScenarioContext<TProject> = {
    execution: runtime.execution,
    project: runtime.project,
    scenario: runtime.definition,
    concurrency: runtime.concurrency,
    scenarioDir: runtime.scenarioDir,
    state,
    notes,
    barrier(name = "default") {
      const existing = barriers.get(name);
      if (existing) {
        return existing;
      }
      const created = new PhaseBarrier(runtime.definition.actors.map((actor) => actor.id));
      barriers.set(name, created);
      return created;
    },
    actor: (id) => runtime.harness.actor(id),
    async phase(actorId, phase, title, task, resource) {
      const started = Date.now();
      try {
        const value = await task();
        const durationMs = Date.now() - started;
        phaseTimings.set(phase, (phaseTimings.get(phase) ?? 0) + durationMs);
        envelopes.push({ actorId, phase, title, resource, status: "passed", durationMs });
        if (resource) {
          resources.push(resource);
        }
        return value;
      } catch (error) {
        const durationMs = Date.now() - started;
        phaseTimings.set(phase, (phaseTimings.get(phase) ?? 0) + durationMs);
        envelopes.push({
          actorId,
          phase,
          title,
          resource,
          status: error instanceof ScenarioSkipError ? "skipped" : "failed",
          durationMs,
          error: error instanceof Error ? error.message : "Unknown phase error"
        });
        throw error;
      }
    },
    expect(condition, message, details) {
      assertions.push({ ok: Boolean(condition), message, ...details });
      if (!condition) {
        throw new Error(message);
      }
    },
    skip(message) {
      throw new ScenarioSkipError(message);
    },
    note(message) {
      notes.push(message);
    },
    set(key, value) {
      state.set(key, value);
      return value;
    },
    get(key) {
      return state.get(key) as undefined;
    },
    resource(prefix) {
      const value = `${slugify(prefix)}-${slugify(runtime.definition.id)}-${runtime.execution.runId}`;
      resources.push(value);
      return value;
    },
    artifact(path) {
      artifacts.add(path);
    }
  };

  let status: ScenarioStatus = "passed";
  try {
    await runtime.definition.preconditions?.(ctx);
    await runtime.definition.execute(ctx);
    await runtime.definition.verify?.(ctx);
  } catch (error) {
    status = error instanceof ScenarioSkipError ? "skipped" : "failed";
    errors.push(error instanceof Error ? error.message : "Unknown scenario error");
    await runtime.harness.captureFailure();
  } finally {
    try {
      await runtime.definition.cleanup?.(ctx);
    } catch (cleanupError) {
      status = "failed";
      errors.push(cleanupError instanceof Error ? cleanupError.message : "Unknown cleanup error");
      await runtime.harness.captureFailure();
    }
    const collected = await runtime.harness.close(status, runtime.execution.flags.keepArtifacts);
    for (const artifact of collected.artifacts) {
      artifacts.add(artifact);
    }
  }

  return {
    id: runtime.definition.id,
    title: runtime.definition.title,
    suite: runtime.definition.suite,
    tags: runtime.definition.tags,
    concurrency: runtime.concurrency,
    status,
    flaky: false,
    attempts: 1,
    durationMs: Date.now() - startedAt.getTime(),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    actors: runtime.definition.actors,
    resources,
    artifacts: [...artifacts],
    finalUrls: runtime.harness.finalUrls(),
    phaseTimings: Object.fromEntries(phaseTimings.entries()),
    assertions,
    envelopes,
    errors,
    notes,
    consoleErrors: runtime.harness.consoleErrors(),
    failedRequests: runtime.harness.failedRequests(),
    httpObservations: runtime.harness.httpObservations()
  };
}

function bootstrapFailureResult<TProject>(
  definition: ScenarioDefinition<TProject>,
  concurrency: ConcurrencyMode,
  startedAt: Date,
  attempt: number,
  error: unknown
): ScenarioResult {
  const message = error instanceof Error ? error.message : "Unknown scenario bootstrap error";
  const durationMs = Date.now() - startedAt.getTime();

  return {
    id: definition.id,
    title: definition.title,
    suite: definition.suite,
    tags: definition.tags,
    concurrency,
    status: "failed",
    flaky: false,
    attempts: attempt,
    durationMs,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    actors: definition.actors,
    resources: [],
    artifacts: [],
    finalUrls: {},
    phaseTimings: {},
    assertions: [],
    envelopes: [
      {
        title: "scenario bootstrap",
        status: "failed",
        durationMs,
        error: message
      }
    ],
    errors: [message],
    notes: [],
    consoleErrors: [],
    failedRequests: [],
    httpObservations: []
  };
}

async function executeScenario<TProject>(
  execution: ExecutionContext,
  project: ProjectRuntime<TProject>,
  definition: ScenarioDefinition<TProject>,
  reporter: ReporterHooks
): Promise<ScenarioResult> {
  reporter.onScenarioStart?.(execution, { id: definition.id, title: definition.title });
  const concurrency = execution.flags.concurrency ?? definition.defaultConcurrency;
  const attempts = Math.max(1, execution.flags.retries + 1);
  let latest: ScenarioResult | undefined;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const attemptDir = resolve(execution.artifactsRoot, definition.id, `attempt-${attempt + 1}`);
    const attemptStartedAt = new Date();
    let result: ScenarioResult;

    try {
      await mkdir(attemptDir, { recursive: true });
      const harnessModule = await import("./browser.ts");
      const harness = await harnessModule.createBrowserHarness(execution, definition, attemptDir, project.config.baseUrl);
      result = await runScenarioAttempt({
        definition,
        execution,
        project,
        concurrency,
        scenarioDir: attemptDir,
        harness
      });
    } catch (error) {
      result = bootstrapFailureResult(definition, concurrency, attemptStartedAt, attempt + 1, error);
    }

    latest = result;
    if (result.status !== "failed") {
      latest.attempts = attempt + 1;
      latest.flaky = attempt > 0 && result.status === "passed";
      reporter.onScenarioComplete?.(execution, latest);
      return latest;
    }
  }

  if (!latest) {
    throw new Error(`Scenario ${definition.id} did not produce a result.`);
  }

  latest.attempts = attempts;
  reporter.onScenarioComplete?.(execution, latest);
  return latest;
}

export async function runSelectedScenarios<TProject>(
  execution: ExecutionContext,
  project: ProjectRuntime<TProject>,
  scenarios: ScenarioDefinition<TProject>[],
  reporter: ReporterHooks
): Promise<RunResult> {
  reporter.onRunStart?.(execution, scenarios.map((scenario) => ({ id: scenario.id, title: scenario.title })));
  const startedAt = new Date();
  const results = new Map<string, ScenarioResult>();

  await runWithLimit(scenarios, execution.flags.workers, async (scenario) => {
    const result = await executeScenario(execution, project, scenario, reporter);
    results.set(scenario.id, result);
  });

  const ordered = scenarios
    .map((scenario) => results.get(scenario.id))
    .filter((scenario): scenario is ScenarioResult => Boolean(scenario));

  const run: RunResult = {
    project: execution.project,
    env: execution.env,
    runId: execution.runId,
    suite: execution.flags.suite,
    scenario: execution.flags.scenario,
    concurrency: execution.flags.concurrency,
    workers: execution.flags.workers,
    actors: execution.flags.actors,
    retries: execution.flags.retries,
    seed: execution.flags.seed,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    summary: buildSummary(ordered),
    scenarios: ordered,
    reportDir: execution.reportDir,
    latestDir: execution.latestDir,
    artifactsRoot: execution.artifactsRoot
  };

  reporter.onRunComplete?.(run);
  return run;
}

export async function writeLatestMirror(run: RunResult, files: Record<string, string>): Promise<void> {
  await mkdir(run.latestDir, { recursive: true });
  for (const [filename, contents] of Object.entries(files)) {
    const latestPath = resolve(run.latestDir, filename);
    await mkdir(dirname(latestPath), { recursive: true });
    await writeFile(latestPath, contents, "utf8");
  }
}

export async function replaceDirectory(pathname: string): Promise<void> {
  await rm(pathname, { recursive: true, force: true }).catch(() => undefined);
  await mkdir(pathname, { recursive: true });
}

export async function readJsonFile<TValue>(pathname: string): Promise<TValue> {
  return JSON.parse(await readFile(pathname, "utf8")) as TValue;
}

export async function writeTextFiles(baseDir: string, files: Record<string, string>): Promise<void> {
  for (const [filename, contents] of Object.entries(files)) {
    const target = join(baseDir, filename);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents, "utf8");
  }
}
