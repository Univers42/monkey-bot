import type { BotDefinition } from "../../orchestrator/types";
import { parseFormXssBotInput, type FormXssBotInput } from "./schema";
import { runFormXssBot, type FormXssBotResult } from "./runner";

export const formXssBot: BotDefinition<FormXssBotInput, FormXssBotResult> = {
  id: "form-xss",
  description:
    "Form reflected-XSS probe with Google mutants calibration (kill seeded faults before reporting target findings)",
  parseInput: parseFormXssBotInput,
  run: runFormXssBot
};
