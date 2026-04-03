import type { NotionLikeConfig, NotionLikeSaveAdapter, NotionLikeUiAdapter } from "../types.ts";

export function createSaveAdapter(
  config: NotionLikeConfig,
  ui: NotionLikeUiAdapter
): NotionLikeSaveAdapter {
  return {
    async waitForStable(actor) {
      if (await ui.visible(actor, config.selectors.document.saveIndicator, 1_000)) {
        await actor.page.waitForTimeout(250);
        return;
      }
      await actor.page.waitForTimeout(800);
    }
  };
}
