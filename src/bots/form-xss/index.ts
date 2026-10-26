import type { BotDefinition } from "../../orchestrator/types";
import { parseFormXssBotInput, type FormXssBotInput } from "./schema";
import { runFormXssBot, type FormXssBotResult } from "./runner";

export const formXssBot: BotDefinition<FormXssBotInput, FormXssBotResult> = {
  id: "form-xss",
  description:
    "Form XSS probe (reflected + attribute) with Google mutants calibration before reporting findings",
  parseInput: parseFormXssBotInput,
  run: runFormXssBot
};
