import { config } from "../config.js";
import type { ChatMessage, TwitchChatClient } from "../twitch/chat.js";
import { logger } from "../utils/logger.js";

export class EngagementReminder {
  private timer?: NodeJS.Timeout;
  private lastViewerActivityAt = 0;
  private lastReminderAt = 0;

  constructor(private readonly chat: TwitchChatClient) {}

  start(): void {
    if (!config.engagement.remindersEnabled) {
      logger.info("Engagement reminders disabled.");
      return;
    }

    this.stop();
    this.timer = setInterval(() => {
      void this.maybeSendReminder();
    }, config.engagement.reminderIntervalMs);

    logger.info(
      `Engagement reminders enabled every ${Math.round(config.engagement.reminderIntervalMs / 60_000)} minutes.`
    );
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  recordViewerActivity(message: ChatMessage): void {
    if (message.text.trim().startsWith("!")) {
      return;
    }

    this.lastViewerActivityAt = Date.now();
  }

  private async maybeSendReminder(): Promise<void> {
    const now = Date.now();
    const hadRecentActivity = now - this.lastViewerActivityAt <= config.engagement.activeChatWindowMs;

    if (!hadRecentActivity) {
      logger.debug("Skipping engagement reminder: no recent chat activity.");
      return;
    }

    if (now - this.lastReminderAt < config.engagement.reminderIntervalMs) {
      return;
    }

    try {
      await this.chat.say(config.engagement.reminderMessage);
      this.lastReminderAt = now;
      logger.info("Sent engagement reminder.");
    } catch (error) {
      logger.error("Failed to send engagement reminder", error);
    }
  }
}
