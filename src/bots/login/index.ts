import type { BotDefinition } from "../../orchestrator/types";
import { parseLoginBotInput, type LoginBotInput } from "./schema";
import { runLoginBot, type LoginBotResult } from "./runner";

export const loginBot: BotDefinition<LoginBotInput, LoginBotResult> = {
  id: "login",
  description: "Login flow scaffold that can probe page readiness now and submit credentials once the feature exists",
  parseInput: parseLoginBotInput,
  run: runLoginBot
};
