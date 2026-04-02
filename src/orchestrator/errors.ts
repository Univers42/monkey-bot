export class BotNotFoundError extends Error {
  constructor(botId: string) {
    super(`Unknown bot id: ${botId}`);
    this.name = "BotNotFoundError";
  }
}

export class BotInputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BotInputValidationError";
  }
}
