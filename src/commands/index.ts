import { config } from "../config.js";
import type { OpenAiClient } from "../openai/client.js";
import type { ChatMessage, TwitchChatClient } from "../twitch/chat.js";
import { Cooldown, formatRemainingSeconds } from "../utils/cooldown.js";
import { logger } from "../utils/logger.js";

interface CommandHandlerOptions {
  chat: TwitchChatClient;
  openai: OpenAiClient;
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
        await this.options.chat.say("Redes: YouTube https://example.com/youtube | Discord https://example.com/discord | X https://example.com/x", message.id);
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

    this.askPerUserCooldown.trigger(message.userId);
    this.aiGlobalCooldown.trigger();

    const answer = await this.options.openai.answerQuestion(question, message.username);
    await this.options.chat.say(`@${message.username} ${answer}`, message.id);
  }
}
