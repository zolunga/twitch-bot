import { config } from "../config.js";
import type { ViewerMemory } from "../memory/viewerMemory.js";
import { OpenAiUnavailableError, type OpenAiClient } from "../openai/client.js";
import type { ChatMessage, TwitchChatClient } from "../twitch/chat.js";
import { Cooldown } from "../utils/cooldown.js";
import { logger } from "../utils/logger.js";

export class FirstChatWelcome {
  private readonly seenUserIds = new Set<string>();
  private readonly recentFacts: string[] = [];
  private readonly globalCooldown = new Cooldown(config.engagement.welcomeFirstChatCooldownMs);

  constructor(
    private readonly chat: TwitchChatClient,
    private readonly openai: OpenAiClient,
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
      const fact = await this.getWelcomeFact();
      const welcome = config.engagement.welcomeFirstChatMessage
        .replaceAll("{username}", message.username)
        .replaceAll("{fact}", fact);

      await this.chat.say(welcome, message.id);
      await this.viewerMemory.markWelcomed(message.userId);
      logger.info(`Sent first-chat welcome to ${message.username}.`);
    } catch (error) {
      logger.error(`Failed to send first-chat welcome to ${message.username}`, error);
    }
  }

  private async getWelcomeFact(): Promise<string> {
    try {
      const fact = await this.openai.generateDisturbingFact(this.recentFacts);
      this.rememberFact(fact);
      return fact;
    } catch (error) {
      if (error instanceof OpenAiUnavailableError) {
        logger.warn(`OpenAI unavailable for welcome fact: ${error.reason}`);
        const fallbackFact = this.getFallbackFact();
        this.rememberFact(fallbackFact);
        return fallbackFact;
      }

      throw error;
    }
  }

  private rememberFact(fact: string): void {
    const normalized = fact.trim();

    if (!normalized) {
      return;
    }

    this.recentFacts.push(normalized);

    while (this.recentFacts.length > 10) {
      this.recentFacts.shift();
    }
  }

  private getFallbackFact(): string {
    const fallbackFacts = [
      "la mayoria del polvo en casa viene de piel muerta.",
      "hay mas bacterias en tu boca que personas en la Tierra.",
      "tu cerebro a veces inventa detalles para rellenar huecos de memoria.",
      "algunos hongos pueden controlar el comportamiento de insectos.",
      "el espacio huele, segun astronautas, parecido a metal caliente."
    ];
    const unused = fallbackFacts.find((fact) => !this.recentFacts.includes(fact));

    return unused ?? fallbackFacts[Math.floor(Math.random() * fallbackFacts.length)];
  }
}
