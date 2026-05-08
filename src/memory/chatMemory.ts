import type { ChatMessage } from "../twitch/chat.js";

interface MemoryMessage {
  username: string;
  text: string;
  seenAt: number;
}

export class ChatMemory {
  private readonly messages: MemoryMessage[] = [];

  constructor(private readonly maxMessages: number) {}

  record(message: ChatMessage): void {
    const text = message.text.trim().replace(/\s+/g, " ");

    if (!text || text.startsWith("!")) {
      return;
    }

    this.messages.push({
      username: message.username,
      text: text.slice(0, 180),
      seenAt: Date.now()
    });

    while (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }
  }

  getRecentForPrompt(limit: number): string {
    return this.messages
      .slice(-limit)
      .map((message) => `@${message.username}: ${message.text}`)
      .join("\n");
  }
}
