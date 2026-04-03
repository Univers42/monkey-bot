import type { BrowserActor } from "../../../browser.ts";
import type { NotionLikeScenarioContext } from "../types.ts";

export async function assertDeniedOrHidden(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  actor: BrowserActor,
  message: string
): Promise<void> {
  const denied = await ctx.project.adapter.sharing.accessDenied(actor);
  const leaked = await ctx.project.adapter.documents.read(actor);
  ctx.expect(denied || leaked.length === 0, message, {
    actorId,
    actual: leaked
  });
}

export async function assertRevokedAccess(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  actor: BrowserActor,
  message: string
): Promise<void> {
  ctx.expect(await ctx.project.adapter.sharing.accessDenied(actor), message, {
    actorId
  });
}
