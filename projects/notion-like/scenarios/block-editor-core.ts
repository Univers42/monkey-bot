import { ownerActor } from "../actors/index.ts";
import { assertDocumentContains } from "../assertions/index.ts";
import type { NotionLikeAdapter, NotionLikeScenario } from "../types.ts";
import { createDocument, requireFeature, scenario } from "./helpers.ts";

export function createBlockEditorCoreScenario(
  adapter: NotionLikeAdapter
): NotionLikeScenario {
  return scenario({
    id: "block-editor-core",
    title: "core block editing survives newline, paste and reload",
    suite: "wave-1",
    tags: ["documents", "editor"],
    concurrency: ["isolated"],
    defaultConcurrency: "isolated",
    actors: [ownerActor],
    preconditions(ctx) {
      requireFeature(ctx, "documents");
    },
    async execute(ctx) {
      const { actor } = await createDocument(ctx, ownerActor.id, "editor");
      const editor = adapter.config.selectors.document.editor;

      await ctx.phase(actor.id, "seed-content", "write initial editor content", async () => {
        await adapter.documents.write(actor, "Line one");
        await actor.page.locator(editor).first().press("Enter");
        await actor.page.locator(editor).first().pressSequentially("Line two");
        await adapter.ui.paste(actor, editor, "Line three\nLine four");
        await actor.page.locator(editor).first().press("Backspace").catch(() => undefined);
        await adapter.save.waitForStable(actor);
      });

      await ctx.phase(actor.id, "verify-editor", "editor state stays coherent after reload", async () => {
        await assertDocumentContains(
          ctx,
          actor.id,
          actor,
          "Line one",
          "Editor should contain first line."
        );
        await actor.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
        await assertDocumentContains(
          ctx,
          actor.id,
          actor,
          "Line two",
          "Editor content should survive reload."
        );
      });
    }
  });
}
