import type {
  NotionLikeConfig,
  NotionLikeDocumentAdapter,
  NotionLikeUiAdapter
} from "../types.ts";

export function createDocumentAdapter(
  config: NotionLikeConfig,
  ui: NotionLikeUiAdapter
): NotionLikeDocumentAdapter {
  return {
    async create(actor, title) {
      await ui.click(actor, config.selectors.document.createButton);
      if (await ui.visible(actor, config.selectors.document.titleInput, 2_000)) {
        await ui.fill(actor, config.selectors.document.titleInput, title);
        await ui.press(actor, config.selectors.document.titleInput, "Enter");
      }
      return actor.page.url();
    },
    async rename(actor, title) {
      await ui.fill(actor, config.selectors.document.titleInput, title);
      await ui.press(actor, config.selectors.document.titleInput, "Enter");
    },
    async write(actor, content) {
      await ui.fill(actor, config.selectors.document.editor, content);
    },
    async append(actor, content) {
      await actor.page.locator(config.selectors.document.editor).first().pressSequentially(content);
    },
    async read(actor) {
      return ui.text(actor, config.selectors.document.editor);
    },
    async open(actor, url) {
      await actor.goto(url);
    },
    async search(actor, query) {
      await actor.goto(config.routes.search);
      await ui.fill(actor, config.selectors.document.searchInput, query);
      await actor.page.waitForTimeout(400);
      return ui.visible(actor, config.selectors.document.searchResult, 2_000);
    },
    async delete(actor) {
      await ui.click(actor, config.selectors.document.deleteButton, 5_000);
    },
    async restore(actor) {
      await ui.click(actor, config.selectors.document.restoreButton, 5_000);
    },
    async readOnly(actor) {
      return ui.visible(actor, config.selectors.document.readOnly, 2_000);
    }
  };
}
