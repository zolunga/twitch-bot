import dotenv from "dotenv";

dotenv.config();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalNumberEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid number for environment variable: ${name}`);
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
    botUsername: requiredEnv("BOT_USERNAME"),
    allowSelfMessages: process.env.ALLOW_BOT_SELF_MESSAGES?.trim().toLowerCase() === "true"
  },
  openai: {
    apiKey: requiredEnv("OPENAI_API_KEY"),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.2",
    personality:
      process.env.BOT_PERSONALITY?.trim() ||
      "Eres ZolungaBot, compa relajado del stream. Respondes en espanol casual, con humor seco, breve y sin exagerar.",
    streamContext:
      process.env.STREAM_CONTEXT?.trim() ||
      "El canal habla de gaming, desarrollo, IA y proyectos creativos. Ayuda a mantener el chat activo."
  },
  cooldowns: {
    aiGlobalMs: 15_000,
    askPerUserMs: 60_000
  },
  commands: {
    socialLinksMessage:
      process.env.SOCIAL_LINKS_MESSAGE?.trim() ||
      "Redes: YouTube https://example.com/youtube | Discord https://example.com/discord | X https://example.com/x",
    socialLinksMessageDelayMs: optionalNumberEnv("SOCIAL_LINKS_MESSAGE_DELAY_MS", 2500)
  },
  engagement: {
    remindersEnabled: process.env.ENGAGEMENT_REMINDERS_ENABLED?.trim().toLowerCase() !== "false",
    reminderIntervalMs: optionalNumberEnv("ENGAGEMENT_REMINDER_INTERVAL_MINUTES", 30) * 60_000,
    activeChatWindowMs: optionalNumberEnv("ENGAGEMENT_ACTIVE_CHAT_WINDOW_MINUTES", 10) * 60_000,
    reminderMessage:
      process.env.ENGAGEMENT_REMINDER_MESSAGE?.trim() ||
      "Estoy por aqui tambien: usa !help para ver comandos, o !ask <pregunta> para preguntarme algo corto.",
    welcomeFirstChatEnabled: process.env.WELCOME_FIRST_CHAT_ENABLED?.trim().toLowerCase() !== "false",
    welcomeFirstChatCooldownMs: optionalNumberEnv("WELCOME_FIRST_CHAT_COOLDOWN_SECONDS", 90) * 1000,
    welcomeFirstChatMessages: parseListEnv(
      process.env.WELCOME_FIRST_CHAT_MESSAGES || process.env.WELCOME_FIRST_CHAT_MESSAGE,
      [
        "Bienvenido @{username}, que gusto verte por aqui. Usa !help si quieres ver comandos.",
        "Hey @{username}, bienvenido al chat. Ponte comodo y disfruta el stream.",
        "Buenas @{username}, llegaste justo a tiempo. Usa !redes si quieres seguir el contenido.",
        "Bienvenido @{username}. Si tienes una pregunta corta, prueba con !ask."
      ]
    )
  },
  memory: {
    maxRecentChatMessages: optionalNumberEnv("MEMORY_RECENT_CHAT_MESSAGES", 20),
    maxPromptChatMessages: optionalNumberEnv("MEMORY_PROMPT_CHAT_MESSAGES", 8)
  },
  stream: {
    contextCacheMs: optionalNumberEnv("STREAM_CONTEXT_CACHE_MINUTES", 2) * 60_000
  }
} as const;

function parseListEnv(value: string | undefined, fallback: string[]): string[] {
  const parsed = value
    ?.split(/\s*(?:\|\||\\n|\r?\n)\s*/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed?.length ? parsed : fallback;
}
