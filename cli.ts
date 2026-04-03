import {
  createRunId,
  createExecutionContext,
  readJsonFile,
  runSelectedScenarios,
  selectScenarios,
  validateScenarioSelection,
  writeLatestMirror,
  writeTextFiles,
  type CliFlags
} from "./core.ts";
import {
  createTerminalReporter,
  formatCliError,
  formatCliInfo,
  printDoctor,
  printList,
  printReportPath,
  renderSummary,
  reportFiles
} from "./reporters.ts";
import { listProjects, loadProject } from "./projects/index.ts";

type Command = "run" | "list" | "doctor" | "report";
type Parsed = {
  command: Command;
  flags: CliFlags;
  input?: string;
  listScenarios?: boolean;
  listSuites?: boolean;
};

function defaults(): CliFlags {
  return {
    env: "local",
    workers: 1,
    headed: false,
    debug: false,
    keepArtifacts: true,
    retries: 0,
    reporter: ["terminal", "json", "junit"]
  };
}

function parse(argv: string[]): Parsed {
  const normalized = argv[0] === "--" ? argv.slice(1) : argv;
  const [command] = normalized;
  if (!command || !["run", "list", "doctor", "report"].includes(command)) {
    throw new Error("Usage: qa-bots <run|list|doctor|report> [flags]");
  }

  const parsed: Parsed = { command: command as Command, flags: defaults() };

  for (let index = 1; index < normalized.length; index += 1) {
    const token = normalized[index];
    const next = normalized[index + 1];

    switch (token) {
      case "--project":
        parsed.flags.project = next;
        index += 1;
        break;
      case "--env":
        parsed.flags.env = next;
        index += 1;
        break;
      case "--suite":
        parsed.flags.suite = next;
        index += 1;
        break;
      case "--scenario":
        parsed.flags.scenario = next;
        index += 1;
        break;
      case "--tag":
        parsed.flags.tag = [...(parsed.flags.tag ?? []), ...(next?.split(",") ?? [])];
        index += 1;
        break;
      case "--concurrency":
        parsed.flags.concurrency = next as CliFlags["concurrency"];
        index += 1;
        break;
      case "--workers":
        parsed.flags.workers = Number(next);
        index += 1;
        break;
      case "--actors":
        parsed.flags.actors = Number(next);
        index += 1;
        break;
      case "--headed":
        parsed.flags.headed = true;
        break;
      case "--debug":
        parsed.flags.debug = true;
        break;
      case "--keep-artifacts":
        parsed.flags.keepArtifacts = true;
        break;
      case "--retries":
        parsed.flags.retries = Number(next);
        index += 1;
        break;
      case "--output":
        parsed.flags.output = next;
        index += 1;
        break;
      case "--reporter":
        parsed.flags.reporter = (next?.split(",") as CliFlags["reporter"]) ?? parsed.flags.reporter;
        index += 1;
        break;
      case "--grep":
        parsed.flags.grep = next;
        index += 1;
        break;
      case "--seed":
        parsed.flags.seed = next;
        index += 1;
        break;
      case "--input":
        parsed.input = next;
        index += 1;
        break;
      case "--scenarios":
        parsed.listScenarios = true;
        break;
      case "--suites":
        parsed.listSuites = true;
        break;
      default:
        throw new Error(`Unknown argument ${token}`);
    }
  }

  return parsed;
}

function suitesOf(runtime: Awaited<ReturnType<typeof loadProject>>): string[] {
  return [...new Set(runtime.scenarios.flatMap((scenario) => [scenario.suite, ...scenario.tags.filter((tag) => tag.startsWith("suite:")).map((tag) => tag.slice(6))]))].sort();
}

function dryExecution(project: string, env: string, flags: CliFlags) {
  return {
    runId: createRunId(flags.seed),
    project,
    env,
    flags,
    reportDir: "",
    latestDir: "",
    artifactsRoot: ""
  };
}

async function runCommand(parsed: Parsed): Promise<void> {
  const projectName = parsed.flags.project;
  if (!projectName) {
    throw new Error("Missing required flag: --project");
  }

  const execution = await createExecutionContext(projectName, parsed.flags.env ?? "local", parsed.flags);
  const runtime = await loadProject(projectName, parsed.flags.env ?? "local", parsed.flags, execution);
  const selected = selectScenarios(runtime, parsed.flags);
  validateScenarioSelection(runtime, selected, parsed.flags);

  const terminal = parsed.flags.reporter.includes("terminal") ? createTerminalReporter() : {};
  const run = await runSelectedScenarios(execution, runtime, selected, terminal);
  const files = reportFiles(run);

  await writeTextFiles(run.reportDir, files);
  await writeLatestMirror(run, files);
  if (parsed.flags.output) {
    await writeTextFiles(parsed.flags.output, files);
  }
  printReportPath(run.reportDir);
}

async function listCommand(parsed: Parsed): Promise<void> {
  const projectName = parsed.flags.project;
  if (!projectName) {
    throw new Error("Missing required flag: --project");
  }

  const execution = dryExecution(projectName, parsed.flags.env ?? "local", parsed.flags);
  const runtime = await loadProject(projectName, parsed.flags.env ?? "local", parsed.flags, execution);

  if (parsed.listScenarios) {
    printList(
      `Scenarios for ${runtime.name}:`,
      runtime.scenarios.map(
        (scenario) =>
          `- ${scenario.id} [${scenario.suite}] (${scenario.concurrency.join(", ")}) tags=${scenario.tags.join(", ")}`
      )
    );
    return;
  }

  if (parsed.listSuites) {
    printList(`Suites for ${runtime.name}:`, suitesOf(runtime).map((suite) => `- ${suite}`));
    return;
  }

  throw new Error("Use list with --scenarios or --suites.");
}

async function doctorCommand(parsed: Parsed): Promise<void> {
  const projectName = parsed.flags.project;
  if (!projectName) {
    throw new Error("Missing required flag: --project");
  }

  const execution = dryExecution(projectName, parsed.flags.env ?? "local", parsed.flags);
  const runtime = await loadProject(projectName, parsed.flags.env ?? "local", parsed.flags, execution);
  const checks = runtime.doctor ? await runtime.doctor(execution) : [];
  printDoctor(execution, checks);
}

async function reportCommand(parsed: Parsed): Promise<void> {
  if (!parsed.input) {
    throw new Error("Missing required flag: --input");
  }

  const run = await readJsonFile<import("./core.ts").RunResult>(parsed.input);
  process.stdout.write(`${renderSummary(run, true)}\n`);
}

async function main(): Promise<void> {
  const parsed = parse(process.argv.slice(2));

  if (parsed.command === "run") {
    await runCommand(parsed);
    return;
  }
  if (parsed.command === "list") {
    await listCommand(parsed);
    return;
  }
  if (parsed.command === "doctor") {
    await doctorCommand(parsed);
    return;
  }
  await reportCommand(parsed);
}

void main().catch((error) => {
  process.stderr.write(`${formatCliError(error instanceof Error ? error.message : "Unknown qa-bots error")}\n`);
  process.stderr.write(`${formatCliInfo(`Available projects: ${listProjects().join(", ")}`)}\n`);
  process.exitCode = 1;
});
