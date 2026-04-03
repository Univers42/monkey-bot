import { createAuthAdapter } from "./auth.ts";
import { createDocumentAdapter } from "./documents.ts";
import { createSaveAdapter } from "./save.ts";
import { createSharingAdapter } from "./sharing.ts";
import { createUiAdapter } from "./ui.ts";
import { createWorkspaceAdapter } from "./workspace.ts";
import type { NotionLikeAdapter, NotionLikeConfig } from "../types.ts";

export function createAdapter(config: NotionLikeConfig): NotionLikeAdapter {
  const ui = createUiAdapter();

  return {
    config,
    route(name) {
      return config.routes[name] ?? "/";
    },
    feature(name) {
      return Boolean(config.featureFlags[name]);
    },
    user(key) {
      const user = config.users[key];
      if (!user) {
        throw new Error(`Unknown notion-like user ${key}`);
      }
      return user;
    },
    ui,
    auth: createAuthAdapter(config, ui),
    workspace: createWorkspaceAdapter(config, ui),
    documents: createDocumentAdapter(config, ui),
    sharing: createSharingAdapter(config, ui),
    save: createSaveAdapter(config, ui)
  };
}
