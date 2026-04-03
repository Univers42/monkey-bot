import type {
  CliFlags,
  ExecutionContext,
  ProjectRuntime
} from "../../core.ts";
import { createAdapter } from "./adapters/index.ts";
import { createConfig } from "./config.ts";
import { runDoctor } from "./doctor.ts";
import { buildNotionLikeScenarios } from "./scenarios/index.ts";
import type { NotionLikeAdapter } from "./types.ts";

export async function createNotionLikeProject(
  _env: string,
  _flags: CliFlags,
  _execution: ExecutionContext
): Promise<ProjectRuntime<NotionLikeAdapter>> {
  const config = createConfig();
  const adapter = createAdapter(config);

  return {
    name: "notion-like",
    description: "Reusable QA adapter for Notion-like collaborative web apps",
    config: {
      baseUrl: config.baseUrl,
      featureFlags: config.featureFlags,
      selectors: config.selectors,
      routes: config.routes
    },
    adapter,
    scenarios: buildNotionLikeScenarios(adapter),
    doctor() {
      return runDoctor(config);
    }
  };
}
