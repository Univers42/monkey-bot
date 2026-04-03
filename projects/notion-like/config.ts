import { createUsers } from "./fixtures/users.ts";
import type { NotionLikeConfig } from "./types.ts";

function envString(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  return value === undefined ? fallback : value === "1" || value === "true";
}

function selector(fallback: string, envKey: string): string {
  return envString(envKey, fallback);
}

export function createConfig(): NotionLikeConfig {
  return {
    baseUrl: envString("QA_NOTION_BASE_URL", "http://localhost:3002"),
    routes: {
      login: envString("QA_NOTION_ROUTE_LOGIN", "/login"),
      signup: envString("QA_NOTION_ROUTE_SIGNUP", "/signup"),
      dashboard: envString("QA_NOTION_ROUTE_DASHBOARD", "/dashboard"),
      workspace: envString("QA_NOTION_ROUTE_WORKSPACE", "/workspace"),
      search: envString("QA_NOTION_ROUTE_SEARCH", "/search")
    },
    selectors: {
      auth: {
        loginForm: selector("[data-testid='login-form'], form", "QA_NOTION_SEL_LOGIN_FORM"),
        loginEmail: selector(
          "[data-testid='login-email'], input[type='email'], input[name='email']",
          "QA_NOTION_SEL_LOGIN_EMAIL"
        ),
        loginPassword: selector(
          "[data-testid='login-password'], input[type='password'], input[name='password']",
          "QA_NOTION_SEL_LOGIN_PASSWORD"
        ),
        loginSubmit: selector("[data-testid='login-submit'], button[type='submit']", "QA_NOTION_SEL_LOGIN_SUBMIT"),
        signupForm: selector("[data-testid='signup-form'], form", "QA_NOTION_SEL_SIGNUP_FORM"),
        signupEmail: selector(
          "[data-testid='signup-email'], input[type='email'], input[name='email']",
          "QA_NOTION_SEL_SIGNUP_EMAIL"
        ),
        signupPassword: selector(
          "[data-testid='signup-password'], input[type='password'], input[name='password']",
          "QA_NOTION_SEL_SIGNUP_PASSWORD"
        ),
        signupConfirm: selector(
          "[data-testid='signup-confirm'], input[name='confirmPassword']",
          "QA_NOTION_SEL_SIGNUP_CONFIRM"
        ),
        signupSubmit: selector("[data-testid='signup-submit'], button[type='submit']", "QA_NOTION_SEL_SIGNUP_SUBMIT"),
        authState: selector(
          "[data-testid='user-menu'], [data-testid='dashboard-shell'], nav[aria-label='workspace']",
          "QA_NOTION_SEL_AUTH_STATE"
        ),
        feedback: selector("[role='alert'], [data-testid='form-error'], .error", "QA_NOTION_SEL_AUTH_FEEDBACK"),
        logout: selector(
          "[data-testid='logout-button'], button:has-text('Logout'), button:has-text('Sign out')",
          "QA_NOTION_SEL_LOGOUT"
        ),
        protectedGate: selector(
          "[data-testid='dashboard-shell'], [data-testid='workspace-shell']",
          "QA_NOTION_SEL_PROTECTED_GATE"
        )
      },
      workspace: {
        emptyState: selector(
          "[data-testid='workspace-empty'], [data-testid='workspace-create']",
          "QA_NOTION_SEL_WORKSPACE_EMPTY"
        ),
        createButton: selector(
          "[data-testid='workspace-create'], button:has-text('Create workspace')",
          "QA_NOTION_SEL_WORKSPACE_CREATE"
        ),
        nameInput: selector("[data-testid='workspace-name'], input[name='workspaceName']", "QA_NOTION_SEL_WORKSPACE_NAME"),
        submit: selector("[data-testid='workspace-submit'], button[type='submit']", "QA_NOTION_SEL_WORKSPACE_SUBMIT"),
        shell: selector("[data-testid='workspace-shell'], nav[aria-label='workspace']", "QA_NOTION_SEL_WORKSPACE_SHELL"),
        sidebar: selector("[data-testid='workspace-sidebar'], aside", "QA_NOTION_SEL_WORKSPACE_SIDEBAR")
      },
      document: {
        createButton: selector(
          "[data-testid='document-create'], button:has-text('New page'), button:has-text('New document')",
          "QA_NOTION_SEL_DOC_CREATE"
        ),
        titleInput: selector(
          "[data-testid='document-title'], input[name='title'], textarea[name='title']",
          "QA_NOTION_SEL_DOC_TITLE"
        ),
        editor: selector("[data-testid='editor-root'], [contenteditable='true']", "QA_NOTION_SEL_EDITOR_ROOT"),
        block: selector("[data-testid='editor-block'], [data-block-id]", "QA_NOTION_SEL_EDITOR_BLOCK"),
        searchInput: selector("[data-testid='search-input'], input[type='search']", "QA_NOTION_SEL_SEARCH_INPUT"),
        searchResult: selector(
          "[data-testid='search-result'], [data-testid='document-row']",
          "QA_NOTION_SEL_SEARCH_RESULT"
        ),
        deleteButton: selector("[data-testid='document-delete'], button:has-text('Delete')", "QA_NOTION_SEL_DOC_DELETE"),
        restoreButton: selector(
          "[data-testid='document-restore'], button:has-text('Restore')",
          "QA_NOTION_SEL_DOC_RESTORE"
        ),
        saveIndicator: selector("[data-testid='save-indicator'], [data-status='saved']", "QA_NOTION_SEL_SAVE_INDICATOR"),
        readOnly: selector("[data-testid='read-only'], [aria-readonly='true']", "QA_NOTION_SEL_READ_ONLY")
      },
      sharing: {
        shareButton: selector("[data-testid='share-button'], button:has-text('Share')", "QA_NOTION_SEL_SHARE_BUTTON"),
        emailInput: selector("[data-testid='share-email'], input[type='email']", "QA_NOTION_SEL_SHARE_EMAIL"),
        roleSelect: selector("[data-testid='share-role'], select", "QA_NOTION_SEL_SHARE_ROLE"),
        submit: selector(
          "[data-testid='share-submit'], button:has-text('Invite'), button:has-text('Share')",
          "QA_NOTION_SEL_SHARE_SUBMIT"
        ),
        revoke: selector("[data-testid='share-revoke'], button:has-text('Revoke')", "QA_NOTION_SEL_SHARE_REVOKE"),
        accessDenied: selector("[data-testid='access-denied'], [role='alert']", "QA_NOTION_SEL_ACCESS_DENIED")
      }
    },
    featureFlags: {
      auth: envBool("QA_NOTION_FEATURE_AUTH", true),
      signup: envBool("QA_NOTION_FEATURE_SIGNUP", true),
      workspaces: envBool("QA_NOTION_FEATURE_WORKSPACES", true),
      documents: envBool("QA_NOTION_FEATURE_DOCUMENTS", true),
      sharing: envBool("QA_NOTION_FEATURE_SHARING", true),
      autosave: envBool("QA_NOTION_FEATURE_AUTOSAVE", true),
      collaboration: envBool("QA_NOTION_FEATURE_COLLABORATION", true),
      search: envBool("QA_NOTION_FEATURE_SEARCH", true)
    },
    behavior: {
      sessionPersistsAfterReload: envBool("QA_NOTION_BEHAVIOR_SESSION_RELOAD", true),
      sessionPersistsAcrossTabs: envBool("QA_NOTION_BEHAVIOR_SESSION_TABS", true),
      sessionPersistsAfterRestart: envBool("QA_NOTION_BEHAVIOR_SESSION_RESTART", false),
      documentRestoreAvailable: envBool("QA_NOTION_BEHAVIOR_DOC_RESTORE", true)
    },
    users: createUsers(),
    api: {
      login: process.env.QA_NOTION_API_LOGIN,
      signup: process.env.QA_NOTION_API_SIGNUP
    }
  };
}
