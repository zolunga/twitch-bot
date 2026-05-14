import type { ChatMessage, TwitchChatClient } from "../twitch/chat.js";

export interface ChatCommandContext {
  message: ChatMessage;
  chat: TwitchChatClient;
  commandName: string;
  args: string[];
  rawText: string;
  bits: number;
}

export interface ChatCommand {
  readonly names: string[];
  handle(context: ChatCommandContext): Promise<void>;
}

