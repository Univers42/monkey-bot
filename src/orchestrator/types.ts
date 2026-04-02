export type BotCatalogItem = {
  id: string;
  description: string;
};

export interface BotDefinition<TInput, TResult> {
  id: string;
  description: string;
  parseInput(input: unknown): TInput;
  run(input: TInput): Promise<TResult>;
}

export type AnyBotDefinition = BotDefinition<unknown, unknown>;
