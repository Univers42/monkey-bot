import type {
  NotionLikeConfig,
  NotionLikeSharingAdapter,
  NotionLikeUiAdapter
} from "../types.ts";

export function createSharingAdapter(
  config: NotionLikeConfig,
  ui: NotionLikeUiAdapter
): NotionLikeSharingAdapter {
  return {
    async share(actor, user, role) {
      await ui.click(actor, config.selectors.sharing.shareButton, 5_000);
      await ui.fill(actor, config.selectors.sharing.emailInput, user.email);
      if (await ui.visible(actor, config.selectors.sharing.roleSelect, 1_000)) {
        await actor.page.locator(config.selectors.sharing.roleSelect).first().selectOption(role).catch(() => undefined);
      }
      await ui.click(actor, config.selectors.sharing.submit, 5_000);
    },
    async revoke(actor, _user) {
      await ui.click(actor, config.selectors.sharing.shareButton, 5_000);
      await ui.click(actor, config.selectors.sharing.revoke, 5_000);
    },
    async accessDenied(actor) {
      return ui.visible(actor, config.selectors.sharing.accessDenied, 2_000);
    }
  };
}
