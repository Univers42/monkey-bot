import { anonymousActor } from "../actors/index.ts";
import {
  assertAnonymous,
  assertNoServerErrors
} from "../assertions/index.ts";
import { invalidSignupCases } from "../fixtures/signup-invalid.ts";
import type { NotionLikeAdapter, NotionLikeScenario } from "../types.ts";
import { requireFeature, scenario } from "./helpers.ts";

export function createSignupValidationScenario(
  adapter: NotionLikeAdapter
): NotionLikeScenario {
  return scenario({
    id: "signup-validation",
    title: "signup rejects invalid payloads cleanly in UI and backend",
    suite: "wave-1",
    tags: ["auth", "validation"],
    concurrency: ["isolated"],
    defaultConcurrency: "isolated",
    actors: [anonymousActor],
    preconditions(ctx) {
      requireFeature(ctx, "signup");
    },
    async execute(ctx) {
      const actor = await ctx.actor(anonymousActor.id);

      for (const current of invalidSignupCases) {
        await ctx.phase(actor.id, current.id, `signup validation ${current.id}`, async () => {
          await adapter.auth.openSignup(actor);
          await adapter.ui.fill(actor, adapter.config.selectors.auth.signupEmail, current.email);
          await adapter.ui.fill(actor, adapter.config.selectors.auth.signupPassword, current.password);
          if (await adapter.ui.visible(actor, adapter.config.selectors.auth.signupConfirm, 500)) {
            await adapter.ui.fill(actor, adapter.config.selectors.auth.signupConfirm, current.confirm);
          }
          await adapter.ui.click(actor, adapter.config.selectors.auth.signupSubmit);
          if (current.doubleSubmit) {
            await adapter.ui.click(actor, adapter.config.selectors.auth.signupSubmit).catch(() => undefined);
          }

          const feedback = await adapter.auth.feedback(actor);
          await assertAnonymous(
            ctx,
            actor.id,
            actor,
            "Invalid signup case must not create a session."
          );
          ctx.expect(
            feedback.length > 0 || actor.page.url().includes(adapter.route("signup")),
            "Invalid signup case must keep the user in an error state."
          );
          assertNoServerErrors(
            ctx,
            actor.id,
            actor,
            "Invalid signup case must not produce HTTP 500 responses."
          );

          const apiResult = await adapter.auth.apiSignup({
            email: current.email,
            password: current.password,
            confirmPassword: current.confirm
          });
          if (apiResult) {
            ctx.expect(apiResult.status >= 400, "Invalid signup API payload must be rejected.");
          }
        });
      }
    }
  });
}
