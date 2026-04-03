import type { CliFlags, ExecutionContext, ProjectDefinition, ProjectRuntime } from "../core.ts";
import { createNotionLikeProject } from "./notion-like/index.ts";

const projects: Record<string, ProjectDefinition<unknown>> = {
  "notion-like": {
    name: "notion-like",
    description: "Reusable QA adapter for Notion-like collaborative web apps",
    async create(env, flags, execution) {
      return (await createNotionLikeProject(env, flags, execution)) as ProjectRuntime<unknown>;
    }
  }
};

export function listProjects(): string[] {
  return Object.keys(projects);
}

export async function loadProject(
  name: string,
  env: string,
  flags: CliFlags,
  execution: ExecutionContext
): Promise<ProjectRuntime<unknown>> {
  const project = projects[name];
  if (!project) {
    throw new Error(`Unknown project ${name}. Available projects: ${listProjects().join(", ")}`);
  }

  return (await project.create(env, flags, execution)) as ProjectRuntime<unknown>;
}
