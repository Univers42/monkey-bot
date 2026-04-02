import type { BotDefinition } from "../../orchestrator/types";
import { parseSmokeBotInput, type SmokeBotInput } from "./schema";
import { runSmokeBot, type SmokeBotResult } from "./runner";

export const smokeBot: BotDefinition<SmokeBotInput, SmokeBotResult> = {
  id: "smoke",
  description: "Basic browser smoke check that collects page title, final URL, console errors, and failed requests",
  parseInput: parseSmokeBotInput,
  run: runSmokeBot
};
