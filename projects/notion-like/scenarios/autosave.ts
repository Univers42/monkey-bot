import { ownerActor } from "../actors/index.ts";
import { assertDocumentContains } from "../assertions/index.ts";
import type { NotionLikeAdapter, NotionLikeScenario } from "../types.ts";
import { createDocument, requireFeature, scenario } from "./helpers.ts";

export function createAutosaveScenario(
  adapter: NotionLikeAdapter
): NotionLikeScenario {
  return scenario({
    id: "autosave",
    title: "autosave preserves pending edits across refresh",
    suite: "wave-1",
    tags: ["documents", "autosave"],
    concurrency: ["isolated"],
    defaultConcurrency: "isolated",
    actors: [ownerActor],
    preconditions(ctx) {
      requireFeature(ctx, "documents");
      requireFeature(ctx, "autosave");
    },
    async execute(ctx) {
      const { actor, title } = await createDocument(ctx, ownerActor.id, "autosave");
      const first = `slow-${title}`;
      const second = `fast-${title}`;

      await ctx.phase(actor.id, "slow-write", "write and wait for autosave", async () => {
        await adapter.documents.write(actor, first);
        await adapter.save.waitForStable(actor);
      });

      await ctx.phase(actor.id, "fast-write", "append rapid edits and refresh", async () => {
        await adapter.documents.append(actor, `\n${second}`);
        await adapter.save.waitForStable(actor);
        await actor.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
        await assertDocumentContains(
          ctx,
          actor.id,
          actor,
          first,
          "Autosaved content should retain the first write."
        );
        await assertDocumentContains(
          ctx,
          actor.id,
          actor,
          second,
          "Autosaved content should retain the fast write."
        );
      });
    }
  });
}
