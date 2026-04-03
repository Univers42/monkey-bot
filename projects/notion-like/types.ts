import type { BrowserActor } from "../../browser.ts";
import type { ScenarioContext, ScenarioDefinition } from "../../core.ts";

export type NotionLikeUser = {
  key: string;
  email: string;
  password: string;
  name: string;
};

export type NotionLikeConfig = {
  baseUrl: string;
  routes: Record<string, string>;
  selectors: Record<string, Record<string, string>>;
  featureFlags: Record<string, boolean>;
  behavior: {
    sessionPersistsAfterReload: boolean;
    sessionPersistsAcrossTabs: boolean;
    sessionPersistsAfterRestart: boolean;
    documentRestoreAvailable: boolean;
  };
  users: Record<string, NotionLikeUser>;
  api: {
    login?: string;
    signup?: string;
  };
};

export type NotionLikeUiAdapter = {
  visible(actor: BrowserActor, selector: string, timeoutMs?: number): Promise<boolean>;
  ensure(actor: BrowserActor, selector: string, label: string, timeoutMs?: number): Promise<void>;
  click(actor: BrowserActor, selector: string, timeoutMs?: number): Promise<void>;
  fill(actor: BrowserActor, selector: string, value: string, timeoutMs?: number): Promise<void>;
  text(actor: BrowserActor, selector: string): Promise<string>;
  texts(actor: BrowserActor, selector: string): Promise<string[]>;
  press(actor: BrowserActor, selector: string, key: string, timeoutMs?: number): Promise<void>;
  paste(actor: BrowserActor, selector: string, value: string, timeoutMs?: number): Promise<void>;
};

export type NotionLikeAuthAdapter = {
  openLogin(actor: BrowserActor): Promise<void>;
  openSignup(actor: BrowserActor): Promise<void>;
  login(actor: BrowserActor, user: NotionLikeUser): Promise<void>;
  logout(actor: BrowserActor): Promise<void>;
  authenticated(actor: BrowserActor): Promise<boolean>;
  feedback(actor: BrowserActor): Promise<string[]>;
  apiSignup(payload: Record<string, unknown>): Promise<{ status: number; body: string } | undefined>;
};

export type NotionLikeWorkspaceAdapter = {
  open(actor: BrowserActor): Promise<void>;
  create(actor: BrowserActor, name: string): Promise<void>;
  loaded(actor: BrowserActor): Promise<boolean>;
};

export type NotionLikeDocumentAdapter = {
  create(actor: BrowserActor, title: string): Promise<string>;
  rename(actor: BrowserActor, title: string): Promise<void>;
  write(actor: BrowserActor, content: string): Promise<void>;
  append(actor: BrowserActor, content: string): Promise<void>;
  read(actor: BrowserActor): Promise<string>;
  open(actor: BrowserActor, url: string): Promise<void>;
  search(actor: BrowserActor, query: string): Promise<boolean>;
  delete(actor: BrowserActor): Promise<void>;
  restore(actor: BrowserActor): Promise<void>;
  readOnly(actor: BrowserActor): Promise<boolean>;
};

export type NotionLikeSharingAdapter = {
  share(actor: BrowserActor, user: NotionLikeUser, role: "viewer" | "editor"): Promise<void>;
  revoke(actor: BrowserActor, user: NotionLikeUser): Promise<void>;
  accessDenied(actor: BrowserActor): Promise<boolean>;
};

export type NotionLikeSaveAdapter = {
  waitForStable(actor: BrowserActor): Promise<void>;
};

export type NotionLikeAdapter = {
  config: NotionLikeConfig;
  route(name: string): string;
  feature(name: string): boolean;
  user(key: string): NotionLikeUser;
  ui: NotionLikeUiAdapter;
  auth: NotionLikeAuthAdapter;
  workspace: NotionLikeWorkspaceAdapter;
  documents: NotionLikeDocumentAdapter;
  sharing: NotionLikeSharingAdapter;
  save: NotionLikeSaveAdapter;
};

export type NotionLikeScenario = ScenarioDefinition<NotionLikeAdapter>;
export type NotionLikeScenarioContext = ScenarioContext<NotionLikeAdapter>;
