import { config } from "../config.js";
import type { ViewerMemory } from "../memory/viewerMemory.js";
import type { ChatMessage, TwitchChatClient } from "../twitch/chat.js";
import { Cooldown } from "../utils/cooldown.js";
import { logger } from "../utils/logger.js";

export class FirstChatWelcome {
  private readonly seenUserIds = new Set<string>();
  private readonly globalCooldown = new Cooldown(config.engagement.welcomeFirstChatCooldownMs);

  constructor(
    private readonly chat: TwitchChatClient,
    private readonly viewerMemory: ViewerMemory
  ) {}

  async maybeWelcome(message: ChatMessage, isFirstSeen: boolean): Promise<void> {
    if (!config.engagement.welcomeFirstChatEnabled) {
      return;
    }

    if (!isFirstSeen) {
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
      const welcome = this.getWelcomeMessage(message.username);

      await this.chat.say(welcome, message.id);
      await this.viewerMemory.markWelcomed(message.userId);
      logger.info(`Sent first-chat welcome to ${message.username}.`);
    } catch (error) {
      logger.error(`Failed to send first-chat welcome to ${message.username}`, error);
    }
  }

  private getWelcomeMessage(username: string): string {
    const templates = config.engagement.welcomeFirstChatMessages;
    const template = templates[Math.floor(Math.random() * templates.length)] ?? "Bienvenido @{username}.";

    return template.replaceAll("{username}", username);
  }
}
