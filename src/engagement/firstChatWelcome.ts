import { config } from "../config.js";
import { OpenAiUnavailableError, type OpenAiClient } from "../openai/client.js";
import type { ChatMessage, TwitchChatClient } from "../twitch/chat.js";
import { Cooldown } from "../utils/cooldown.js";
import { logger } from "../utils/logger.js";

export class FirstChatWelcome {
  private readonly seenUserIds = new Set<string>();
  private readonly globalCooldown = new Cooldown(config.engagement.welcomeFirstChatCooldownMs);

  constructor(
    private readonly chat: TwitchChatClient,
    private readonly openai: OpenAiClient
  ) {}

  async maybeWelcome(message: ChatMessage): Promise<void> {
    if (!config.engagement.welcomeFirstChatEnabled) {
      return;
    }

    if (message.text.trim().startsWith("!")) {
      this.seenUserIds.add(message.userId);
      return;
    }

    if (this.seenUserIds.has(message.userId)) {
      return;
    }

    this.seenUserIds.add(message.userId);

    if (!this.globalCooldown.tryAcquire()) {
      logger.debug(`Skipping first-chat welcome for ${message.username}: welcome cooldown active.`);
      return;
    }

    try {
      const fact = await this.getWelcomeFact();
      const welcome = config.engagement.welcomeFirstChatMessage
        .replaceAll("{username}", message.username)
        .replaceAll("{fact}", fact);

      await this.chat.say(welcome, message.id);
      logger.info(`Sent first-chat welcome to ${message.username}.`);
    } catch (error) {
      logger.error(`Failed to send first-chat welcome to ${message.username}`, error);
    }
  }

  private async getWelcomeFact(): Promise<string> {
    try {
      return await this.openai.generateDisturbingFact();
    } catch (error) {
      if (error instanceof OpenAiUnavailableError) {
        logger.warn(`OpenAI unavailable for welcome fact: ${error.reason}`);
        return "la mayoria del polvo en casa viene de piel muerta.";
      }

      throw error;
    }
  }
}
