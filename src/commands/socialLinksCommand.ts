import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { ChatCommand, ChatCommandContext } from "./types.js";

export class SocialLinksCommand implements ChatCommand {
  readonly names = ["!redes"];

  async handle({ chat, message }: ChatCommandContext): Promise<void> {
    const lines = config.commands.socialLinksMessage
      .split(/\s*(?:\|\||\\n|\r?\n)\s*/g)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      await chat.say("Redes no configuradas todavia.", message.id);
      return;
    }

    for (const [index, line] of lines.entries()) {
      await this.sayWithRateLimitRetry(chat.say.bind(chat), line, index === 0 ? message.id : undefined);

      if (index < lines.length - 1) {
        await sleep(config.commands.socialLinksMessageDelayMs);
      }
    }
  }

  private async sayWithRateLimitRetry(
    say: (message: string, replyParentMessageId?: string) => Promise<void>,
    message: string,
    replyParentMessageId?: string
  ): Promise<void> {
    try {
      await say(message, replyParentMessageId);
    } catch (error) {
      if (!isTwitchRateLimitError(error)) {
        throw error;
      }

      logger.warn("Twitch chat rate limit hit. Retrying social link message once.");
      await sleep(config.commands.socialLinksMessageDelayMs * 2);
      await say(message, replyParentMessageId);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTwitchRateLimitError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("429");
}

