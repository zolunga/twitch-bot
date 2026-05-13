import OpenAI from "openai";
import { config } from "../config.js";
import type { StreamContext } from "../twitch/api.js";

const TWITCH_CHAT_SOFT_LIMIT = 450;

export class OpenAiUnavailableError extends Error {
  constructor(
    message: string,
    public readonly reason: "insufficient_quota" | "rate_limited" | "unavailable" = "unavailable"
  ) {
    super(message);
    this.name = "OpenAiUnavailableError";
  }
}

export interface AnswerContext {
  recentChat: string;
  stream?: StreamContext;
}

export class OpenAiClient {
  private readonly client = new OpenAI({
    apiKey: config.openai.apiKey
  });

  async answerQuestion(question: string, username: string, context: AnswerContext): Promise<string> {
    let response: OpenAI.Responses.Response;

    try {
      response = await this.client.responses.create({
        model: config.openai.model,
        instructions: [
          config.openai.personality,
          config.openai.streamContext,
          "Reply in the same language as the user when possible.",
          "Keep answers short, upbeat, and streamer-style.",
          "Use stream title, category, tags, and recent chat only as lightweight context. Do not invent facts.",
          "Never generate hateful, sexual, or harassment content. If asked for it, refuse briefly and redirect.",
          `Your full answer must fit comfortably in one Twitch chat message under ${TWITCH_CHAT_SOFT_LIMIT} characters.`
        ].join(" "),
        input: buildInput(question, username, context),
        max_output_tokens: 90
      });
    } catch (error) {
      throw normalizeOpenAiError(error);
    }

    return sanitizeForTwitch(response.output_text || "No tengo una respuesta corta ahora mismo.");
  }
}

function buildInput(question: string, username: string, context: AnswerContext): string {
  const stream = context.stream;
  const streamLines = stream
    ? [
        `Live: ${stream.isLive ? "yes" : "no"}`,
        `Title: ${stream.title || "unknown"}`,
        `Category: ${stream.gameName || "unknown"}`,
        `Tags: ${stream.tags.length ? stream.tags.join(", ") : "none"}`,
        stream.viewerCount === undefined ? undefined : `Viewers: ${stream.viewerCount}`
      ].filter(Boolean)
    : ["Stream context unavailable."];

  return [
    "Current stream context:",
    ...streamLines,
    "",
    "Recent chat:",
    context.recentChat || "No recent non-command chat messages.",
    "",
    `Viewer @${username} asks: ${question}`
  ].join("\n");
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

function normalizeOpenAiError(error: unknown): OpenAiUnavailableError {
  if (error instanceof OpenAI.APIError) {
    const code = typeof error.code === "string" ? error.code : undefined;

    if (code === "insufficient_quota") {
      return new OpenAiUnavailableError("OpenAI quota or billing is not available.", "insufficient_quota");
    }

    if (error.status === 429) {
      return new OpenAiUnavailableError("OpenAI rate limit reached.", "rate_limited");
    }

    return new OpenAiUnavailableError(`OpenAI request failed with status ${error.status ?? "unknown"}.`);
  }

  return new OpenAiUnavailableError("OpenAI request failed.");
}
