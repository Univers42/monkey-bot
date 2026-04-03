import {
  collaboratorActor,
  ownerActor
} from "../actors/index.ts";
import {
  assertDocumentContains,
  assertRevokedAccess,
  assertViewerCannotEdit
} from "../assertions/index.ts";
import type { NotionLikeAdapter, NotionLikeScenario } from "../types.ts";
import {
  createDocument,
  loginActor,
  requireFeature,
  scenario
} from "./helpers.ts";

export function createSharedDocumentPermissionsScenario(
  adapter: NotionLikeAdapter
): NotionLikeScenario {
  return scenario({
    id: "shared-document-permissions",
    title: "share, promote and revoke document permissions between two users",
    suite: "wave-1",
    tags: ["permissions", "sharing", "collaboration"],
    concurrency: ["coordinated", "conflict"],
    defaultConcurrency: "coordinated",
    actors: [ownerActor, collaboratorActor],
    preconditions(ctx) {
      requireFeature(ctx, "documents");
      requireFeature(ctx, "sharing");
    },
    async execute(ctx) {
      const owner = await createDocument(ctx, ownerActor.id, "shared");
      const collaborator = await loginActor(ctx, collaboratorActor.id, "collaborator");
      const otherUser = adapter.user("collaborator");

      await ctx.phase(owner.actor.id, "share-viewer", "share document as viewer", async () => {
        await adapter.sharing.share(owner.actor, otherUser, "viewer");
        ctx.set("shared-url", owner.url);
      });

      await ctx.phase(collaborator.id, "viewer-open", "viewer can open but not edit", async () => {
        await adapter.documents.open(collaborator, String(ctx.get("shared-url")));
        await assertViewerCannotEdit(
          ctx,
          collaborator.id,
          collaborator,
          "Viewer should not be able to edit."
        );
      });

      await ctx.phase(owner.actor.id, "share-editor", "promote collaborator to editor", async () => {
        await adapter.sharing.share(owner.actor, otherUser, "editor");
      });

      await ctx.phase(collaborator.id, "editor-write", "editor can write after promotion", async () => {
        if (ctx.concurrency === "conflict") {
          await Promise.all([
            adapter.documents.append(owner.actor, "\nowner-conflict"),
            adapter.documents.append(collaborator, "\ncollaborator-conflict")
          ]);
        } else {
          await adapter.documents.append(collaborator, "\ncollaborator-edit");
        }
        await adapter.save.waitForStable(collaborator);
        await owner.actor.page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
        await assertDocumentContains(
          ctx,
          owner.actor.id,
          owner.actor,
          "collaborator",
          "Owner should see collaborator changes after editor promotion."
        );
      });

      await ctx.phase(owner.actor.id, "revoke", "revoke collaborator access", async () => {
        await adapter.sharing.revoke(owner.actor, otherUser);
      });

      await ctx.phase(collaborator.id, "verify-revoked", "revoked user loses access", async () => {
        await adapter.documents.open(collaborator, String(ctx.get("shared-url")));
        await assertRevokedAccess(
          ctx,
          collaborator.id,
          collaborator,
          "Revoked user should lose access."
        );
      });
    }
  });
}
