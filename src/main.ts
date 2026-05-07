import { config } from "./config.js";
import { CommandHandler } from "./commands/index.js";
import { ModerationRules } from "./moderation/rules.js";
import { OpenAiClient } from "./openai/client.js";
import { validateBotAccessToken } from "./twitch/auth.js";
import { TwitchChatClient, type ChatMessage } from "./twitch/chat.js";
import { TwitchEventSubClient } from "./twitch/eventsub.js";
import { logger } from "./utils/logger.js";

const chat = new TwitchChatClient();
const openai = new OpenAiClient();
const commands = new CommandHandler({ chat, openai });
const moderation = new ModerationRules();

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

  if (isMessageFromBot(message)) {
    return;
  }

  logger.info(`[chat] ${message.username}: ${text}`);

  for (const alert of moderation.inspect(message)) {
    logger.warn(`[MOD ALERT] possible spam from ${message.username}: ${alert.reason}`);
  }

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

  eventSub.start();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown(): void {
  logger.info("Shutting down bot...");
  eventSub.stop();
  process.exit(0);
}

bootstrap().catch((error) => {
  logger.error("Bot failed to start", error);
  process.exit(1);
});
