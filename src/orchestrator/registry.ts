import { smokeBot } from "../bots/smoke";
import { loginBot } from "../bots/login";
import type { AnyBotDefinition } from "./types";

const botRegistry = new Map<string, AnyBotDefinition>([
  [smokeBot.id, smokeBot],
  [loginBot.id, loginBot]
]);

export function getBotById(botId: string): AnyBotDefinition | undefined {
  return botRegistry.get(botId);
}

export function listBotDefinitions(): AnyBotDefinition[] {
  return Array.from(botRegistry.values());
}
