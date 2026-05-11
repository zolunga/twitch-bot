import { config } from "./config.js";
import { CommandHandler } from "./commands/index.js";
import { FirstChatWelcome } from "./engagement/firstChatWelcome.js";
import { EngagementReminder } from "./engagement/reminder.js";
import { ChatMemory } from "./memory/chatMemory.js";
import { ViewerMemory } from "./memory/viewerMemory.js";
import { ModerationRules } from "./moderation/rules.js";
import { OpenAiClient } from "./openai/client.js";
import { TwitchApiClient } from "./twitch/api.js";
import { validateBotAccessToken } from "./twitch/auth.js";
import { TwitchChatClient, type ChatMessage } from "./twitch/chat.js";
import { TwitchEventSubClient } from "./twitch/eventsub.js";
import { logger } from "./utils/logger.js";

const chat = new TwitchChatClient();
const openai = new OpenAiClient();
const memory = new ChatMemory(config.memory.maxRecentChatMessages);
const viewerMemory = new ViewerMemory();
const twitchApi = new TwitchApiClient();
const commands = new CommandHandler({ chat, openai, memory, twitchApi });
const moderation = new ModerationRules();
const engagementReminder = new EngagementReminder(chat);
const firstChatWelcome = new FirstChatWelcome(chat, openai, viewerMemory);

const eventSub = new TwitchEventSubClient({
  onChatMessage: async (message) => {
    await handleChatMessage(message);
  }
});

async function handleChatMessage(message: ChatMessage): Promise<void> {
  const text = message.text.trim();

  if (!text) {
    return;
  }

  logger.info(`[chat] ${message.username}: ${text}`);

  if (isMessageFromBot(message)) {
    if (config.twitch.allowSelfMessages) {
      await commands.handle(message);
      return;
    }

    logger.debug(`[chat] ignored self message from ${message.username}`);
    return;
  }

  const moderationAlerts = moderation.inspect(message);

  for (const alert of moderationAlerts) {
    logger.warn(`[MOD ALERT] possible spam from ${message.username}: ${alert.reason}`);
  }

  if (moderationAlerts.length > 0) {
    logger.info(`[chat] skipped engagement for ${message.username}: moderation alert`);
    return;
  }

  const viewerUpdate = await viewerMemory.recordMessage(message);
  memory.record(message);
  engagementReminder.recordViewerActivity(message);
  await firstChatWelcome.maybeWelcome(message, viewerUpdate.isFirstSeen);

  await commands.handle(message);
}

function isMessageFromBot(message: ChatMessage): boolean {
  return (
    message.userId === config.twitch.botUserId ||
    message.userLogin.toLowerCase() === config.twitch.botUsername.toLowerCase() ||
    message.username.toLowerCase() === config.twitch.botUsername.toLowerCase()
  );
}

async function bootstrap(): Promise<void> {
  const token = await validateBotAccessToken();
  logger.info(`Validated Twitch token for ${token.login} with scopes: ${token.scopes.join(", ") || "none"}`);

  await viewerMemory.load();
  eventSub.start();
  engagementReminder.start();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown(): void {
  logger.info("Shutting down bot...");
  engagementReminder.stop();
  eventSub.stop();
  process.exit(0);
}

bootstrap().catch((error) => {
  logger.error("Bot failed to start", error);
  process.exit(1);
});
