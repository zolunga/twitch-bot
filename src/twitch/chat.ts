import { config } from "../config.js";

interface SendChatMessageResponse {
  data: Array<{
    message_id: string;
    is_sent: boolean;
  }>;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userLogin: string;
  username: string;
  text: string;
  raw: unknown;
}

export class TwitchChatClient {
  async say(message: string, replyParentMessageId?: string): Promise<void> {
    const safeMessage = message.replace(/\s+/g, " ").trim().slice(0, 500);

    if (!safeMessage) {
      return;
    }

    const body: Record<string, string> = {
      broadcaster_id: config.twitch.broadcasterUserId,
      sender_id: config.twitch.botUserId,
      message: safeMessage
    };

    if (replyParentMessageId) {
      body.reply_parent_message_id = replyParentMessageId;
    }

    const response = await fetch("https://api.twitch.tv/helix/chat/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.twitch.botAccessToken}`,
        "Client-Id": config.twitch.clientId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Failed to send Twitch chat message: ${response.status} ${await response.text()}`);
    }

    const result = (await response.json()) as SendChatMessageResponse;
    const first = result.data[0];

    if (!first?.is_sent) {
      throw new Error("Twitch accepted the request but did not send the chat message.");
    }
  }
}
