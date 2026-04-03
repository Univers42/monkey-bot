import type { NotionLikeAuthAdapter, NotionLikeConfig, NotionLikeUiAdapter } from "../types.ts";

export function createAuthAdapter(
  config: NotionLikeConfig,
  ui: NotionLikeUiAdapter
): NotionLikeAuthAdapter {
  return {
    async openLogin(actor) {
      await actor.goto(config.routes.login);
      await ui.ensure(actor, config.selectors.auth.loginForm, "login form");
    },
    async openSignup(actor) {
      await actor.goto(config.routes.signup);
      await ui.ensure(actor, config.selectors.auth.signupForm, "signup form");
    },
    async login(actor, user) {
      await actor.goto(config.routes.login);
      await ui.fill(actor, config.selectors.auth.loginEmail, user.email);
      await ui.fill(actor, config.selectors.auth.loginPassword, user.password);
      await ui.click(actor, config.selectors.auth.loginSubmit);
      await actor.page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
    },
    async logout(actor) {
      await ui.click(actor, config.selectors.auth.logout, 3_000);
      await actor.page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
    },
    async authenticated(actor) {
      return (
        (await ui.visible(actor, config.selectors.auth.authState)) ||
        (await ui.visible(actor, config.selectors.auth.protectedGate))
      );
    },
    async feedback(actor) {
      return ui.texts(actor, config.selectors.auth.feedback);
    },
    async apiSignup(payload) {
      if (!config.api.signup) {
        return undefined;
      }

      const response = await fetch(new URL(config.api.signup, config.baseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      return { status: response.status, body: await response.text() };
    }
  };
}
