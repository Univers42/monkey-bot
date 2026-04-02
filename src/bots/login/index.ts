import type { BotDefinition } from "../../orchestrator/types";
import {
  parseLegacyLoginBotInput,
  parseLoginMultiuserRealtimeBotInput,
  parseLoginSecurityBotInput,
  parseLoginSessionLifecycleBotInput,
  parseLoginSmokeBotInput,
  parseLoginValidationBotInput,
  type LegacyLoginBotInput,
  type LoginMultiuserRealtimeBotInput,
  type LoginSecurityBotInput,
  type LoginSessionLifecycleBotInput,
  type LoginSmokeBotInput,
  type LoginValidationBotInput
} from "./schema";
import {
  runLegacyLoginBot,
  runLoginMultiuserRealtimeBot,
  runLoginSecurityBot,
  runLoginSessionLifecycleBot,
  runLoginSmokeBot,
  runLoginValidationBot,
  type LegacyLoginBotResult,
  type LoginMultiuserRealtimeBotResult,
  type LoginSecurityBotResult,
  type LoginSessionLifecycleBotResult,
  type LoginSmokeBotResult,
  type LoginValidationBotResult
} from "./runner";

export const legacyLoginBot: BotDefinition<LegacyLoginBotInput, LegacyLoginBotResult> = {
  id: "login",
  description: "Legacy alias of login-smoke with scenario reporting and artifact capture",
  parseInput: parseLegacyLoginBotInput,
  run: runLegacyLoginBot
};

export const loginBot = legacyLoginBot;

export const loginSmokeBot: BotDefinition<LoginSmokeBotInput, LoginSmokeBotResult> = {
  id: "login-smoke",
  description: "Normal login smoke flow: page readiness, valid login, reload persistence, and logout",
  parseInput: parseLoginSmokeBotInput,
  run: runLoginSmokeBot
};

export const loginValidationBot: BotDefinition<LoginValidationBotInput, LoginValidationBotResult> = {
  id: "login-validation",
  description: "Login input validation suite: empty fields, malformed identities, large payloads, and double submits",
  parseInput: parseLoginValidationBotInput,
  run: runLoginValidationBot
};

export const loginSecurityBot: BotDefinition<LoginSecurityBotInput, LoginSecurityBotResult> = {
  id: "login-security",
  description: "Login security suite: wrong credentials, user-enumeration masking, protected routes, replay, and malformed requests",
  parseInput: parseLoginSecurityBotInput,
  run: runLoginSecurityBot
};

export const loginSessionLifecycleBot: BotDefinition<
  LoginSessionLifecycleBotInput,
  LoginSessionLifecycleBotResult
> = {
  id: "login-session-lifecycle",
  description: "Login session lifecycle suite: session creation, reload, new-tab sharing, logout invalidation, and restart behavior",
  parseInput: parseLoginSessionLifecycleBotInput,
  run: runLoginSessionLifecycleBot
};

export const loginMultiuserRealtimeBot: BotDefinition<
  LoginMultiuserRealtimeBotInput,
  LoginMultiuserRealtimeBotResult
> = {
  id: "login-multiuser-realtime",
  description: "Concurrent login and realtime suite: multiple users, multi-tab state, and websocket auth checks",
  parseInput: parseLoginMultiuserRealtimeBotInput,
  run: runLoginMultiuserRealtimeBot
};

export const loginBots = [
  legacyLoginBot,
  loginSmokeBot,
  loginValidationBot,
  loginSecurityBot,
  loginSessionLifecycleBot,
  loginMultiuserRealtimeBot
];
