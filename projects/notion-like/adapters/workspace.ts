import type {
  NotionLikeConfig,
  NotionLikeUiAdapter,
  NotionLikeWorkspaceAdapter
} from "../types.ts";

export function createWorkspaceAdapter(
  config: NotionLikeConfig,
  ui: NotionLikeUiAdapter
): NotionLikeWorkspaceAdapter {
  return {
    async open(actor) {
      await actor.goto(config.routes.workspace);
    },
    async create(actor, name) {
      await actor.goto(config.routes.workspace);
      await ui.click(actor, config.selectors.workspace.createButton);
      await ui.fill(actor, config.selectors.workspace.nameInput, name);
      await ui.click(actor, config.selectors.workspace.submit);
    },
    async loaded(actor) {
      return (
        (await ui.visible(actor, config.selectors.workspace.shell)) ||
        (await ui.visible(actor, config.selectors.workspace.sidebar))
      );
    }
  };
}
