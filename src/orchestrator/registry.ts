import { smokeBot } from "../bots/smoke";
import type { AnyBotDefinition } from "./types";

const botRegistry = new Map<string, AnyBotDefinition>([[smokeBot.id, smokeBot]]);

export function getBotById(botId: string): AnyBotDefinition | undefined {
  return botRegistry.get(botId);
}

export function listBotDefinitions(): AnyBotDefinition[] {
  return Array.from(botRegistry.values());
}
