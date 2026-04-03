import { ownerActor } from "../actors/index.ts";
import {
  assertNoConsoleErrors
} from "../assertions/index.ts";
import type { NotionLikeAdapter, NotionLikeScenario } from "../types.ts";
import { loginActor, requireFeature, scenario, suiteTag } from "./helpers.ts";

export function createLoginSuccessScenario(
  adapter: NotionLikeAdapter
): NotionLikeScenario {
  return scenario({
    id: "login-success",
    title: "valid user can authenticate and reach a protected area",
    suite: "wave-1",
    tags: ["auth", suiteTag("smoke")],
    concurrency: ["isolated"],
    defaultConcurrency: "isolated",
    actors: [ownerActor],
    preconditions(ctx) {
      requireFeature(ctx, "auth");
    },
    async execute(ctx) {
      const actor = await loginActor(ctx, ownerActor.id);

      await ctx.phase(ownerActor.id, "reload", "reload keeps expected session state", async () => {
        await actor.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
        const authenticated = await adapter.auth.authenticated(actor);
        ctx.expect(
          authenticated === adapter.config.behavior.sessionPersistsAfterReload,
          "Reload session behavior differs from project expectations.",
          { actorId: ownerActor.id, phase: "reload", actual: authenticated }
        );
      });

      await ctx.phase(ownerActor.id, "new-tab", "new tab sees consistent auth state", async () => {
        const tab = await actor.openTab();
        await tab.goto(new URL(adapter.route("dashboard"), actor.baseUrl).toString(), {
          waitUntil: "domcontentloaded"
        });
        const authenticated = await tab.locator(adapter.config.selectors.auth.authState)
          .first()
          .isVisible()
          .catch(() => false);
        ctx.expect(
          authenticated === adapter.config.behavior.sessionPersistsAcrossTabs,
          "Cross-tab session behavior differs from project expectations."
        );
      });

      assertNoConsoleErrors(
        ctx,
        ownerActor.id,
        actor,
        "Login scenario should not emit console errors."
      );
    }
  });
}
