import OpenAI from "openai";
import { config } from "../config.js";

const TWITCH_CHAT_SOFT_LIMIT = 450;

export class OpenAiClient {
  private readonly client = new OpenAI({
    apiKey: config.openai.apiKey
  });

  async answerQuestion(question: string, username: string): Promise<string> {
    const response = await this.client.responses.create({
      model: config.openai.model,
      instructions: [
        "You are a friendly Twitch chat bot for streamer engagement.",
        "Reply in the same language as the user when possible.",
        "Keep answers short, upbeat, and streamer-style.",
        "Never generate hateful, sexual, or harassment content. If asked for it, refuse briefly and redirect.",
        `Your full answer must fit comfortably in one Twitch chat message under ${TWITCH_CHAT_SOFT_LIMIT} characters.`
      ].join(" "),
      input: `Viewer @${username} asks: ${question}`,
      max_output_tokens: 90
    });

    return sanitizeForTwitch(response.output_text || "No tengo una respuesta corta ahora mismo.");
  }
}

function sanitizeForTwitch(text: string): string {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/^\/+/, "")
    .trim();

  if (cleaned.length <= TWITCH_CHAT_SOFT_LIMIT) {
    return cleaned;
  }

  return `${cleaned.slice(0, TWITCH_CHAT_SOFT_LIMIT - 1).trim()}...`;
}
