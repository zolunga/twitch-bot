import dotenv from "dotenv";

dotenv.config();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const config = {
  twitch: {
    clientId: requiredEnv("TWITCH_CLIENT_ID"),
    clientSecret: requiredEnv("TWITCH_CLIENT_SECRET"),
    botAccessToken: requiredEnv("TWITCH_BOT_ACCESS_TOKEN"),
    botUserId: requiredEnv("TWITCH_BOT_USER_ID"),
    broadcasterUserId: requiredEnv("TWITCH_BROADCASTER_USER_ID"),
    botUsername: requiredEnv("BOT_USERNAME")
  },
  openai: {
    apiKey: requiredEnv("OPENAI_API_KEY"),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.2"
  },
  cooldowns: {
    aiGlobalMs: 15_000,
    askPerUserMs: 60_000
  }
} as const;
