import { config } from "../config.js";
import type { ChatMemory } from "../memory/chatMemory.js";
import { inspectAskQuestion } from "../moderation/askGuard.js";
import { OpenAiUnavailableError, type OpenAiClient } from "../openai/client.js";
import type { TwitchApiClient } from "../twitch/api.js";
import type { ChatMessage, TwitchChatClient } from "../twitch/chat.js";
import { Cooldown, formatRemainingSeconds } from "../utils/cooldown.js";
import { logger } from "../utils/logger.js";

interface CommandHandlerOptions {
  chat: TwitchChatClient;
  openai: OpenAiClient;
  memory: ChatMemory;
  twitchApi: TwitchApiClient;
}

export class CommandHandler {
  private readonly aiGlobalCooldown = new Cooldown(config.cooldowns.aiGlobalMs);
  private readonly askPerUserCooldown = new Cooldown(config.cooldowns.askPerUserMs);

  constructor(private readonly options: CommandHandlerOptions) {}

  async handle(message: ChatMessage): Promise<void> {
    const text = message.text.trim();

    if (!text.startsWith("!")) {
      return;
    }

    const [commandName = "", ...args] = text.split(/\s+/);
    const command = commandName.toLowerCase();

    try {
      if (command === "!ping") {
        await this.options.chat.say("pong", message.id);
        return;
      }

      if (command === "!hola") {
        await this.options.chat.say(`Hola @${message.username}!`, message.id);
        return;
      }

      if (command === "!redes") {
        await this.handleSocialLinks(message);
        return;
      }

      if (command === "!help") {
        await this.options.chat.say("Comandos: !ping, !hola, !redes, !ask <pregunta>, !help", message.id);
        return;
      }

      if (command === "!ask") {
        await this.handleAsk(message, args.join(" ").trim());
      }
    } catch (error) {
      logger.error(`Command ${command} failed`, error);
    }
  }

  private async handleAsk(message: ChatMessage, question: string): Promise<void> {
    if (!question) {
      await this.options.chat.say(`@${message.username} uso: !ask <pregunta>`, message.id);
      return;
    }

    const askGuard = inspectAskQuestion(question);
    if (!askGuard.allowed) {
      logger.warn(`Blocked !ask from ${message.username}: ${askGuard.reason}`);
      await this.options.chat.say(`@${message.username} ${askGuard.reply ?? "no puedo responder esa pregunta por chat."}`, message.id);
      return;
    }

    if (!this.askPerUserCooldown.isReady(message.userId)) {
      const seconds = formatRemainingSeconds(this.askPerUserCooldown.remainingMs(message.userId));
      await this.options.chat.say(`@${message.username} espera ${seconds}s antes de usar !ask otra vez.`, message.id);
      return;
    }

    if (!this.aiGlobalCooldown.isReady()) {
      const seconds = formatRemainingSeconds(this.aiGlobalCooldown.remainingMs());
      await this.options.chat.say(`@${message.username} la IA esta en cooldown global. Intenta en ${seconds}s.`, message.id);
      return;
    }

    try {
      const streamContext = await this.getStreamContext();
      const answer = await this.options.openai.answerQuestion(question, message.username, {
        recentChat: this.options.memory.getRecentForPrompt(config.memory.maxPromptChatMessages),
        stream: streamContext
      });
      this.askPerUserCooldown.trigger(message.userId);
      this.aiGlobalCooldown.trigger();
      await this.options.chat.say(`@${message.username} ${answer}`, message.id);
    } catch (error) {
      if (error instanceof OpenAiUnavailableError) {
        logger.warn(`OpenAI unavailable for !ask: ${error.reason}`);
        await this.options.chat.say(`@${message.username} la IA no esta disponible ahora mismo. Prueba de nuevo mas tarde.`, message.id);
        return;
      }

      throw error;
    }
  }

  private async handleSocialLinks(message: ChatMessage): Promise<void> {
    const lines = config.commands.socialLinksMessage
      .split(/\s*(?:\|\||\\n|\r?\n)\s*/g)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      await this.options.chat.say("Redes no configuradas todavia.", message.id);
      return;
    }

    for (const [index, line] of lines.entries()) {
      await this.sayWithRateLimitRetry(line, index === 0 ? message.id : undefined);

      if (index < lines.length - 1) {
        await sleep(config.commands.socialLinksMessageDelayMs);
      }
    }
  }

  private async sayWithRateLimitRetry(message: string, replyParentMessageId?: string): Promise<void> {
    try {
      await this.options.chat.say(message, replyParentMessageId);
    } catch (error) {
      if (!isTwitchRateLimitError(error)) {
        throw error;
      }

      logger.warn("Twitch chat rate limit hit. Retrying social link message once.");
      await sleep(config.commands.socialLinksMessageDelayMs * 2);
      await this.options.chat.say(message, replyParentMessageId);
    }
  }

  private async getStreamContext() {
    try {
      return await this.options.twitchApi.getStreamContext();
    } catch (error) {
      logger.warn("Could not load Twitch stream context for !ask", error);
      return undefined;
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
