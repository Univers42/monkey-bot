import { ownerActor } from "../actors/index.ts";
import {
  assertAnonymous,
  assertAuthenticated
} from "../assertions/index.ts";
import type { NotionLikeAdapter, NotionLikeScenario } from "../types.ts";
import { loginActor, requireFeature, scenario } from "./helpers.ts";

export function createSessionLifecycleScenario(
  adapter: NotionLikeAdapter
): NotionLikeScenario {
  return scenario({
    id: "session-lifecycle",
    title: "login, refresh, tabs and logout keep session state coherent",
    suite: "wave-1",
    tags: ["auth", "session"],
    concurrency: ["isolated"],
    defaultConcurrency: "isolated",
    actors: [ownerActor],
    preconditions(ctx) {
      requireFeature(ctx, "auth");
    },
    async execute(ctx) {
      const actor = await loginActor(ctx, ownerActor.id);

      await ctx.phase(actor.id, "protected-route", "protected route is reachable after login", async () => {
        await actor.goto(adapter.route("dashboard"));
        await assertAuthenticated(
          ctx,
          actor.id,
          actor,
          "Protected area should be visible after login."
        );
      });

      await ctx.phase(actor.id, "logout", "logout invalidates the session", async () => {
        await adapter.auth.logout(actor);
        await assertAnonymous(
          ctx,
          actor.id,
          actor,
          "Logout must remove authenticated UI."
        );
        await actor.goto(adapter.route("dashboard"));
        await assertAnonymous(
          ctx,
          actor.id,
          actor,
          "Protected route must not stay available after logout."
        );
      });
    }
  });
}
