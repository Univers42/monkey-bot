import type { BrowserActor } from "../../../browser.ts";
import type { NotionLikeScenarioContext } from "../types.ts";

export async function assertDocumentContains(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  actor: BrowserActor,
  expected: string,
  message: string
): Promise<void> {
  ctx.expect((await ctx.project.adapter.documents.read(actor)).includes(expected), message, {
    actorId,
    expected
  });
}

export async function assertDocumentSearchHit(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  actor: BrowserActor,
  query: string,
  message: string
): Promise<void> {
  ctx.expect(await ctx.project.adapter.documents.search(actor, query), message, {
    actorId,
    expected: query
  });
}

export async function assertViewerCannotEdit(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  actor: BrowserActor,
  message: string
): Promise<void> {
  const readOnly = await ctx.project.adapter.documents.readOnly(actor);
  const denied = await ctx.project.adapter.sharing.accessDenied(actor);
  ctx.expect(readOnly || !denied, message, { actorId });
}
