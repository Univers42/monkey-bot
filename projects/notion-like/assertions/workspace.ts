import type { BrowserActor } from "../../../browser.ts";
import type { NotionLikeScenarioContext } from "../types.ts";

export async function assertWorkspaceLoaded(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  actor: BrowserActor,
  message: string
): Promise<void> {
  ctx.expect(await ctx.project.adapter.workspace.loaded(actor), message, { actorId });
}

export async function assertWorkspaceEntryPoint(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  actor: BrowserActor,
  message: string
): Promise<void> {
  const selectors = ctx.project.adapter.config.selectors.workspace;
  ctx.expect(
    (await ctx.project.adapter.workspace.loaded(actor)) ||
      (await ctx.project.adapter.ui.visible(actor, selectors.createButton)),
    message,
    { actorId }
  );
}
