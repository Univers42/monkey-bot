import type { BrowserActor } from "../../../browser.ts";
import type { NotionLikeScenarioContext } from "../types.ts";

export async function assertAuthenticated(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  actor: BrowserActor,
  message: string
): Promise<void> {
  ctx.expect(await ctx.project.adapter.auth.authenticated(actor), message, {
    actorId
  });
}

export async function assertAnonymous(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  actor: BrowserActor,
  message: string
): Promise<void> {
  ctx.expect(!(await ctx.project.adapter.auth.authenticated(actor)), message, {
    actorId
  });
}

export function assertNoConsoleErrors(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  actor: BrowserActor,
  message: string
): void {
  ctx.expect(actor.consoleErrors.length === 0, message, { actorId });
}

export function assertNoServerErrors(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  actor: BrowserActor,
  message: string
): void {
  ctx.expect(
    actor.httpObservations.every((observation) => observation.status < 500),
    message,
    { actorId }
  );
}
