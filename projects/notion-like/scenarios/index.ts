import type { NotionLikeAdapter, NotionLikeScenario } from "../types.ts";
import { createAutosaveScenario } from "./autosave.ts";
import { createBlockEditorCoreScenario } from "./block-editor-core.ts";
import { createDocumentCrudScenario } from "./document-crud.ts";
import { createFirstWorkspaceCreationScenario } from "./first-workspace-creation.ts";
import { createLoginSuccessScenario } from "./login-success.ts";
import { createPrivateDocumentAccessScenario } from "./private-document-access.ts";
import { createSessionLifecycleScenario } from "./session-lifecycle.ts";
import { createSharedDocumentPermissionsScenario } from "./shared-document-permissions.ts";
import { createSignupValidationScenario } from "./signup-validation.ts";
import { createSmokeCoreScenario } from "./smoke-core.ts";

export function buildNotionLikeScenarios(
  adapter: NotionLikeAdapter
): NotionLikeScenario[] {
  return [
    createLoginSuccessScenario(adapter),
    createSignupValidationScenario(adapter),
    createSessionLifecycleScenario(adapter),
    createFirstWorkspaceCreationScenario(adapter),
    createDocumentCrudScenario(adapter),
    createBlockEditorCoreScenario(adapter),
    createAutosaveScenario(adapter),
    createPrivateDocumentAccessScenario(adapter),
    createSharedDocumentPermissionsScenario(adapter),
    createSmokeCoreScenario(adapter)
  ];
}
