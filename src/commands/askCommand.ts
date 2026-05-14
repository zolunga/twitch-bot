import { config } from "../config.js";
import type { ChatMemory } from "../memory/chatMemory.js";
import { inspectAskQuestion } from "../moderation/askGuard.js";
import { OpenAiUnavailableError, type OpenAiClient } from "../openai/client.js";
import type { TwitchApiClient } from "../twitch/api.js";
import { Cooldown, formatRemainingSeconds } from "../utils/cooldown.js";
import { logger } from "../utils/logger.js";
import type { ChatCommand, ChatCommandContext } from "./types.js";

interface AskCommandOptions {
  openai: OpenAiClient;
  memory: ChatMemory;
  twitchApi: TwitchApiClient;
}

export class AskCommand implements ChatCommand {
  readonly names = ["!ask"];
  private readonly aiGlobalCooldown = new Cooldown(config.cooldowns.aiGlobalMs);
  private readonly askPerUserCooldown = new Cooldown(config.cooldowns.askPerUserMs);

  constructor(private readonly options: AskCommandOptions) {}

  async handle({ chat, message, args }: ChatCommandContext): Promise<void> {
    const question = args.join(" ").trim();

    if (!question) {
      await chat.say(`@${message.username} uso: !ask <pregunta>`, message.id);
      return;
    }

    const askGuard = inspectAskQuestion(question);
    if (!askGuard.allowed) {
      logger.warn(`Blocked !ask from ${message.username}: ${askGuard.reason}`);
      await chat.say(`@${message.username} ${askGuard.reply ?? "no puedo responder esa pregunta por chat."}`, message.id);
      return;
    }

    if (!this.askPerUserCooldown.isReady(message.userId)) {
      const seconds = formatRemainingSeconds(this.askPerUserCooldown.remainingMs(message.userId));
      await chat.say(`@${message.username} espera ${seconds}s antes de usar !ask otra vez.`, message.id);
      return;
    }

    if (!this.aiGlobalCooldown.isReady()) {
      const seconds = formatRemainingSeconds(this.aiGlobalCooldown.remainingMs());
      await chat.say(`@${message.username} la IA esta en cooldown global. Intenta en ${seconds}s.`, message.id);
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
      await chat.say(`@${message.username} ${answer}`, message.id);
    } catch (error) {
      if (error instanceof OpenAiUnavailableError) {
        logger.warn(`OpenAI unavailable for !ask: ${error.reason}`);
        await chat.say(`@${message.username} la IA no esta disponible ahora mismo. Prueba de nuevo mas tarde.`, message.id);
        return;
      }

      throw error;
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

