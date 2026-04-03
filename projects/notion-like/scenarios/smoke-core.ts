import { ownerActor } from "../actors/index.ts";
import {
  assertAnonymous,
  assertDocumentContains,
  assertDocumentSearchHit
} from "../assertions/index.ts";
import type { NotionLikeAdapter, NotionLikeScenario } from "../types.ts";
import {
  ensureWorkspace,
  requireFeature,
  scenario,
  suiteTag
} from "./helpers.ts";

export function createSmokeCoreScenario(
  adapter: NotionLikeAdapter
): NotionLikeScenario {
  return scenario({
    id: "smoke-core",
    title: "minimum healthy flow across auth, workspace and document shell",
    suite: "wave-1",
    tags: ["smoke", suiteTag("smoke")],
    concurrency: ["isolated"],
    defaultConcurrency: "isolated",
    actors: [ownerActor],
    preconditions(ctx) {
      requireFeature(ctx, "auth");
      requireFeature(ctx, "documents");
    },
    async execute(ctx) {
      const actor = await ensureWorkspace(ctx, ownerActor.id);
      const title = ctx.resource("smoke-doc");

      await ctx.phase(actor.id, "smoke-create", "create and edit document", async () => {
        await adapter.documents.create(actor, title);
        await adapter.documents.write(actor, `smoke-${title}`);
        await adapter.save.waitForStable(actor);
        await assertDocumentContains(
          ctx,
          actor.id,
          actor,
          title,
          "Smoke document should contain written title."
        );
      }, title);

      await ctx.phase(actor.id, "smoke-search", "search locates the document", async () => {
        if (adapter.feature("search")) {
          await assertDocumentSearchHit(
            ctx,
            actor.id,
            actor,
            title,
            "Smoke document should be searchable."
          );
        }
      });

      await ctx.phase(actor.id, "smoke-logout", "logout leaves the app in anonymous state", async () => {
        await adapter.auth.logout(actor);
        await assertAnonymous(
          ctx,
          actor.id,
          actor,
          "Smoke flow should end anonymous after logout."
        );
      });
    }
  });
}
