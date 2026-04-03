import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
  Request,
  Response
} from "playwright-core";
import { chromium } from "playwright-core";
import type {
  ActorDefinition,
  ExecutionContext,
  ScenarioStatus
} from "./core.ts";

type HttpObservation = {
  actorId: string;
  method: string;
  url: string;
  status: number;
  bodyPreview?: string;
};

export type BrowserActor = {
  id: string;
  role: string;
  userKey?: string;
  context: BrowserContext;
  page: Page;
  baseUrl: string;
  dir: string;
  consoleErrors: string[];
  failedRequests: string[];
  httpObservations: HttpObservation[];
  goto(target: string, timeoutMs?: number): Promise<void>;
  openTab(): Promise<Page>;
  screenshot(name: string): Promise<string | undefined>;
};

export type BrowserHarness = {
  actor(id: string): Promise<BrowserActor>;
  captureFailure(): Promise<void>;
  close(status: ScenarioStatus, keepArtifacts: boolean): Promise<{ artifacts: string[] }>;
  finalUrls(): Record<string, string>;
  consoleErrors(): string[];
  failedRequests(): string[];
  httpObservations(): HttpObservation[];
};

type InternalActor = BrowserActor & {
  pages: Set<Page>;
  tracePath: string;
  videoPaths: string[];
  failurePath?: string;
};

export function resolveChromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH) {
    return process.env.CHROMIUM_PATH;
  }

  for (const candidate of ["/usr/bin/chromium-browser", "/usr/bin/chromium"]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function asUrl(baseUrl: string, target: string): string {
  return new URL(target, baseUrl).toString();
}

async function previewBody(response: Response): Promise<string | undefined> {
  try {
    const type = (await response.headerValue("content-type")) ?? "";
    if (!type.includes("application/json") && !type.includes("text/")) {
      return undefined;
    }
    return (await response.text()).slice(0, 300);
  } catch {
    return undefined;
  }
}

function trackFailedRequest(actor: InternalActor, request: Request): void {
  actor.failedRequests.push(
    `${request.method()} ${request.url()} (${request.failure()?.errorText ?? "unknown request failure"})`
  );
}

async function trackResponse(actor: InternalActor, response: Response): Promise<void> {
  if (actor.httpObservations.length >= 20 && response.status() < 400) {
    return;
  }

  actor.httpObservations.push({
    actorId: actor.id,
    method: response.request().method(),
    url: response.url(),
    status: response.status(),
    bodyPreview: await previewBody(response)
  });
}

function attachMonitoring(actor: InternalActor, page: Page): void {
  actor.pages.add(page);
  page.on("console", (message) => {
    if (message.type() === "error") {
      actor.consoleErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    trackFailedRequest(actor, request);
  });
  page.on("response", (response) => {
    void trackResponse(actor, response);
  });
}

async function createActor(
  browser: Browser,
  baseUrl: string,
  scenarioDir: string,
  definition: ActorDefinition,
  headed: boolean
): Promise<InternalActor> {
  const dir = join(scenarioDir, definition.id);
  await mkdir(dir, { recursive: true });

  const options: BrowserContextOptions = {
    ignoreHTTPSErrors: true
  };

  if (!headed) {
    options.recordVideo = { dir, size: { width: 1280, height: 720 } };
  }

  const context = await browser.newContext(options);
  const page = await context.newPage();
  const actor: InternalActor = {
    id: definition.id,
    role: definition.role,
    userKey: definition.userKey,
    context,
    page,
    baseUrl,
    dir,
    consoleErrors: [],
    failedRequests: [],
    httpObservations: [],
    pages: new Set<Page>(),
    tracePath: join(dir, "trace.zip"),
    videoPaths: [],
    async goto(target, timeoutMs = 30_000) {
      await page.goto(asUrl(baseUrl, target), { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 2_000) }).catch(() => undefined);
    },
    async openTab() {
      const next = await context.newPage();
      attachMonitoring(actor, next);
      return next;
    },
    async screenshot(name) {
      const path = join(dir, `${name}.png`);
      try {
        await page.screenshot({ path, fullPage: true });
        return path;
      } catch {
        return undefined;
      }
    }
  };

  attachMonitoring(actor, page);
  await context.tracing.start({ screenshots: true, snapshots: true }).catch(() => undefined);
  return actor;
}

export async function createBrowserHarness(
  execution: ExecutionContext,
  scenario: { id: string; actors: ActorDefinition[] },
  scenarioDir: string,
  baseUrl: string
): Promise<BrowserHarness> {
  const executablePath = resolveChromiumPath();
  const browser = await chromium.launch({
    executablePath,
    headless: !execution.flags.headed,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });

  const actors = new Map<string, InternalActor>();

  return {
    async actor(id) {
      const existing = actors.get(id);
      if (existing) {
        return existing;
      }

      const definition = scenario.actors.find((actor) => actor.id === id);
      if (!definition) {
        throw new Error(`Unknown actor ${id} in scenario ${scenario.id}.`);
      }

      const created = await createActor(browser, baseUrl, scenarioDir, definition, execution.flags.headed);
      actors.set(id, created);
      return created;
    },
    async captureFailure() {
      for (const actor of actors.values()) {
        actor.failurePath = actor.failurePath ?? (await actor.screenshot("failure"));
      }
    },
    async close(status, keepArtifacts) {
      const artifacts = new Set<string>();

      for (const actor of actors.values()) {
        try {
          await actor.context.tracing.stop({ path: actor.tracePath });
          artifacts.add(actor.tracePath);
        } catch {
          // tracing is best effort
        }

        for (const page of actor.pages) {
          try {
            const video = await page.video()?.path();
            if (video) {
              actor.videoPaths.push(video);
              artifacts.add(video);
            }
          } catch {
            // video is optional
          }
        }

        if (actor.failurePath) {
          artifacts.add(actor.failurePath);
        }

        await actor.context.close();
      }

      await browser.close();

      if (status === "passed" && !keepArtifacts) {
        await rm(scenarioDir, { recursive: true, force: true }).catch(() => undefined);
        return { artifacts: [] };
      }

      return { artifacts: [...artifacts] };
    },
    finalUrls() {
      return Object.fromEntries([...actors.values()].map((actor) => [actor.id, actor.page.url()]));
    },
    consoleErrors() {
      return [...actors.values()].flatMap((actor) => actor.consoleErrors);
    },
    failedRequests() {
      return [...actors.values()].flatMap((actor) => actor.failedRequests);
    },
    httpObservations() {
      return [...actors.values()].flatMap((actor) => actor.httpObservations);
    }
  };
}
