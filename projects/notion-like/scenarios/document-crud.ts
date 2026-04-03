import { ownerActor } from "../actors/index.ts";
import {
  assertDocumentContains,
  assertDocumentSearchHit
} from "../assertions/index.ts";
import type { NotionLikeAdapter, NotionLikeScenario } from "../types.ts";
import { createDocument, requireFeature, scenario } from "./helpers.ts";

export function createDocumentCrudScenario(
  adapter: NotionLikeAdapter
): NotionLikeScenario {
  return scenario({
    id: "document-crud",
    title: "create, rename, edit, reopen and delete a document",
    suite: "wave-1",
    tags: ["documents", "crud"],
    concurrency: ["isolated"],
    defaultConcurrency: "isolated",
    actors: [ownerActor],
    preconditions(ctx) {
      requireFeature(ctx, "documents");
    },
    async execute(ctx) {
      const { actor, title, url } = await createDocument(ctx, ownerActor.id, "document");
      const renamed = `${title}-renamed`;
      const body = `body-${title}`;

      await ctx.phase(actor.id, "rename", `rename document to ${renamed}`, async () => {
        await adapter.documents.rename(actor, renamed);
      }, renamed);

      await ctx.phase(actor.id, "write", "write content", async () => {
        await adapter.documents.write(actor, body);
        await adapter.save.waitForStable(actor);
      });

      await ctx.phase(actor.id, "reopen", "reopen and validate persisted content", async () => {
        await actor.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
        await assertDocumentContains(
          ctx,
          actor.id,
          actor,
          body,
          "Document body should persist after reload."
        );
        if (adapter.feature("search")) {
          await assertDocumentSearchHit(
            ctx,
            actor.id,
            actor,
            renamed,
            "Document should appear in search results."
          );
        }
        await adapter.documents.open(actor, url);
      });

      await ctx.phase(actor.id, "delete", "delete or trash document", async () => {
        await adapter.documents.delete(actor);
        if (adapter.config.behavior.documentRestoreAvailable) {
          await adapter.documents.restore(actor);
          await assertDocumentContains(
            ctx,
            actor.id,
            actor,
            body,
            "Restored document should still contain content."
          );
        }
      });
    }
  });
}
