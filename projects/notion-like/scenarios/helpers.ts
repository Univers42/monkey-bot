import type { BrowserActor } from "../../../browser.ts";
import { ScenarioSkipError } from "../../../core.ts";
import {
  assertAuthenticated,
  assertWorkspaceEntryPoint
} from "../assertions/index.ts";
import type { NotionLikeScenario, NotionLikeScenarioContext } from "../types.ts";

export function scenario(definition: NotionLikeScenario): NotionLikeScenario {
  return definition;
}

export function suiteTag(name: string): string {
  return `suite:${name}`;
}

export function requireFeature(
  ctx: NotionLikeScenarioContext,
  feature: string
): void {
  if (!ctx.project.adapter.feature(feature)) {
    throw new ScenarioSkipError(`Feature ${feature} is disabled for this project config.`);
  }
}

export async function actorAndUser(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  userKey = "owner"
): Promise<{
  actor: BrowserActor;
  user: ReturnType<typeof ctx.project.adapter.user>;
}> {
  return {
    actor: await ctx.actor(actorId),
    user: ctx.project.adapter.user(userKey)
  };
}

export async function loginActor(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  userKey = "owner"
): Promise<BrowserActor> {
  const { actor, user } = await actorAndUser(ctx, actorId, userKey);
  await ctx.phase(actorId, "login", `log in as ${user.email}`, async () => {
    await ctx.project.adapter.auth.login(actor, user);
    await assertAuthenticated(
      ctx,
      actorId,
      actor,
      "Expected authenticated UI after login."
    );
  });
  return actor;
}

export async function ensureWorkspace(
  ctx: NotionLikeScenarioContext,
  actorId: string
): Promise<BrowserActor> {
  const actor = await loginActor(ctx, actorId);
  if (!ctx.project.adapter.feature("workspaces")) {
    return actor;
  }

  await ctx.phase(actorId, "workspace-shell", "open workspace shell", async () => {
    await ctx.project.adapter.workspace.open(actor);
    await assertWorkspaceEntryPoint(
      ctx,
      actorId,
      actor,
      "Expected workspace shell or create entrypoint."
    );
  });
  return actor;
}

export async function createDocument(
  ctx: NotionLikeScenarioContext,
  actorId: string,
  prefix: string
): Promise<{ actor: BrowserActor; title: string; url: string }> {
  requireFeature(ctx, "documents");
  const actor = await ensureWorkspace(ctx, actorId);
  const title = ctx.resource(prefix);
  const url = await ctx.phase(actorId, "create-document", `create document ${title}`, async () =>
    ctx.project.adapter.documents.create(actor, title), title);
  return { actor, title, url };
}
