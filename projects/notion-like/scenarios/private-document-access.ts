import {
  collaboratorActor,
  ownerActor
} from "../actors/index.ts";
import { assertDeniedOrHidden } from "../assertions/index.ts";
import type { NotionLikeAdapter, NotionLikeScenario } from "../types.ts";
import {
  createDocument,
  loginActor,
  requireFeature,
  scenario
} from "./helpers.ts";

export function createPrivateDocumentAccessScenario(
  adapter: NotionLikeAdapter
): NotionLikeScenario {
  return scenario({
    id: "private-document-access",
    title: "a private document is not readable by an unauthorized user",
    suite: "wave-1",
    tags: ["permissions", "sharing"],
    concurrency: ["coordinated", "conflict"],
    defaultConcurrency: "coordinated",
    actors: [ownerActor, collaboratorActor],
    preconditions(ctx) {
      requireFeature(ctx, "documents");
    },
    async execute(ctx) {
      const barrier = ctx.barrier("doc-created");
      await Promise.all([
        (async () => {
          const owner = await createDocument(ctx, ownerActor.id, "private");
          await ctx.phase(owner.actor.id, "write-private", "write private content", async () => {
            await adapter.documents.write(owner.actor, `private-${owner.title}`);
            ctx.set("private-url", owner.url);
            await barrier.wait("created", owner.actor.id);
          }, owner.title);
        })(),
        (async () => {
          const collaborator = await loginActor(ctx, collaboratorActor.id, "collaborator");
          await ctx.phase(collaborator.id, "open-private", "attempt to access private URL", async () => {
            await barrier.wait("created", collaborator.id);
            await adapter.documents.open(collaborator, String(ctx.get("private-url")));
            await assertDeniedOrHidden(
              ctx,
              collaborator.id,
              collaborator,
              "Unauthorized user must not read private content."
            );
          });
        })()
      ]);
    }
  });
}
