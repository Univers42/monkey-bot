import { freshActor } from "../actors/index.ts";
import { assertWorkspaceLoaded } from "../assertions/index.ts";
import type { NotionLikeAdapter, NotionLikeScenario } from "../types.ts";
import { loginActor, requireFeature, scenario } from "./helpers.ts";

export function createFirstWorkspaceCreationScenario(
  adapter: NotionLikeAdapter
): NotionLikeScenario {
  return scenario({
    id: "first-workspace-creation",
    title: "a new user can create the first workspace and keep it after reload",
    suite: "wave-1",
    tags: ["workspace", "onboarding"],
    concurrency: ["isolated"],
    defaultConcurrency: "isolated",
    actors: [freshActor],
    preconditions(ctx) {
      requireFeature(ctx, "workspaces");
    },
    async execute(ctx) {
      const actor = await loginActor(ctx, freshActor.id, "fresh");
      const workspaceName = ctx.resource("workspace");

      await ctx.phase(actor.id, "create-workspace", `create workspace ${workspaceName}`, async () => {
        await adapter.workspace.create(actor, workspaceName);
        await assertWorkspaceLoaded(
          ctx,
          actor.id,
          actor,
          "Workspace shell should appear after creation."
        );
      }, workspaceName);

      await ctx.phase(actor.id, "reload-workspace", "workspace persists after reload", async () => {
        await actor.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
        await assertWorkspaceLoaded(
          ctx,
          actor.id,
          actor,
          "Workspace shell should remain after reload."
        );
      });
    }
  });
}
