import { BotNotFoundError } from "./errors";
import { getBotById, listBotDefinitions } from "./registry";
import type { BotCatalogItem } from "./types";

export function listBots(): BotCatalogItem[] {
  return listBotDefinitions().map((bot) => ({
    id: bot.id,
    description: bot.description
  }));
}

export async function runBotById(botId: string, input: unknown): Promise<unknown> {
  const bot = getBotById(botId);
  if (!bot) {
    throw new BotNotFoundError(botId);
  }

  const parsedInput = bot.parseInput(input);
  return bot.run(parsedInput);
}
