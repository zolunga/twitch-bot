import WebSocket from "ws";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import type { ChatMessage } from "./chat.js";

const EVENTSUB_WEBSOCKET_URL = "wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=30";

type EventSubMessageType =
  | "session_welcome"
  | "session_keepalive"
  | "session_reconnect"
  | "notification"
  | "revocation";

interface EventSubEnvelope {
  metadata: {
    message_id: string;
    message_type: EventSubMessageType;
    subscription_type?: string;
  };
  payload: {
    session?: {
      id: string;
      keepalive_timeout_seconds: number | null;
      reconnect_url: string | null;
    };
    event?: {
      broadcaster_user_id: string;
      chatter_user_id: string;
      chatter_user_login: string;
      chatter_user_name: string;
      message_id: string;
      message?: {
        text?: string;
        fragments?: unknown[];
      };
      badges?: unknown[];
      id?: string;
      user_id?: string;
      user_login?: string;
      user_name?: string;
      user_input?: string;
      reward?: {
        id?: string;
        title?: string;
      };
    };
    subscription?: {
      id: string;
      status: string;
      type: string;
    };
  };
}

export interface RewardRedemption {
  id: string;
  userId: string;
  userLogin: string;
  username: string;
  rewardId?: string;
  rewardTitle: string;
  userInput: string;
  raw: unknown;
}

interface TwitchEventSubClientOptions {
  accessToken: string;
  chatUserId?: string;
  onChatMessage?: (message: ChatMessage) => Promise<void> | void;
  onRewardRedemption?: (redemption: RewardRedemption) => Promise<void> | void;
}

export class TwitchEventSubClient {
  private socket?: WebSocket;
  private keepaliveTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private shouldReconnect = true;
  private reconnectAttempt = 0;
  private keepaliveTimeoutSeconds = 30;

  constructor(private readonly options: TwitchEventSubClientOptions) {}

  start(): void {
    this.connect(EVENTSUB_WEBSOCKET_URL, false);
  }

  stop(): void {
    this.shouldReconnect = false;
    this.clearTimers();
    this.socket?.close(1000, "Bot shutting down");
  }

  private connect(url: string, isTwitchReconnect: boolean, oldSocket?: WebSocket): void {
    logger.info(`Connecting to Twitch EventSub WebSocket${isTwitchReconnect ? " using reconnect URL" : ""}...`);

    const ws = new WebSocket(url);

    ws.on("message", (data) => {
      void this.handleMessage(ws, data.toString(), isTwitchReconnect, oldSocket);
    });

    ws.on("close", (code, reason) => {
      logger.warn(`Twitch EventSub WebSocket closed: ${code} ${reason.toString()}`);

      if (ws !== this.socket || !this.shouldReconnect) {
        return;
      }

      this.scheduleReconnect();
    });

    ws.on("error", (error) => {
      logger.error("Twitch EventSub WebSocket error", error);
    });
  }

  private async handleMessage(
    ws: WebSocket,
    rawMessage: string,
    isTwitchReconnect: boolean,
    oldSocket?: WebSocket
  ): Promise<void> {
    let envelope: EventSubEnvelope;

    try {
      envelope = JSON.parse(rawMessage) as EventSubEnvelope;
    } catch (error) {
      logger.warn("Received invalid EventSub message", error);
      return;
    }

    const messageType = envelope.metadata.message_type;

    if (messageType !== "session_reconnect") {
      this.resetKeepaliveTimer(ws, envelope.payload.session?.keepalive_timeout_seconds);
    }

    if (messageType === "session_welcome") {
      this.socket = ws;
      this.reconnectAttempt = 0;

      const session = envelope.payload.session;
      if (!session) {
        logger.warn("EventSub welcome message did not include a session.");
        return;
      }

      logger.info(`EventSub session connected: ${session.id}`);
      this.keepaliveTimeoutSeconds = session.keepalive_timeout_seconds ?? this.keepaliveTimeoutSeconds;
      this.resetKeepaliveTimer(ws, session.keepalive_timeout_seconds);

      if (isTwitchReconnect) {
        oldSocket?.close(1000, "Reconnected to Twitch EventSub");
        return;
      }

      await this.subscribeToChatMessages(session.id);
      await this.subscribeToRewardRedemptions(session.id);
      return;
    }

    if (messageType === "session_keepalive") {
      logger.debug("EventSub keepalive received.");
      return;
    }

    if (messageType === "session_reconnect") {
      const reconnectUrl = envelope.payload.session?.reconnect_url;

      if (!reconnectUrl) {
        logger.warn("EventSub requested reconnect without reconnect_url.");
        this.scheduleReconnect();
        return;
      }

      this.connect(reconnectUrl, true, ws);
      return;
    }

    if (messageType === "revocation") {
      logger.warn("EventSub subscription revoked", envelope.payload.subscription);
      return;
    }

    if (messageType === "notification" && envelope.metadata.subscription_type === "channel.chat.message") {
      const event = envelope.payload.event;

      if (!event) {
        logger.warn("Chat notification did not include an event payload.");
        return;
      }

      await this.options.onChatMessage?.({
        id: event.message_id,
        userId: event.chatter_user_id,
        userLogin: event.chatter_user_login,
        username: event.chatter_user_name || event.chatter_user_login,
        text: event.message?.text ?? "",
        raw: event
      });
      return;
    }

    if (
      messageType === "notification" &&
      envelope.metadata.subscription_type === "channel.channel_points_custom_reward_redemption.add"
    ) {
      const event = envelope.payload.event;

      if (!event) {
        logger.warn("Reward redemption notification did not include an event payload.");
        return;
      }

      await this.options.onRewardRedemption?.({
        id: event.id ?? "",
        userId: event.user_id ?? "",
        userLogin: event.user_login ?? "",
        username: event.user_name || event.user_login || "",
        rewardId: event.reward?.id,
        rewardTitle: event.reward?.title ?? "",
        userInput: event.user_input ?? "",
        raw: event
      });
    }
  }

  private async subscribeToChatMessages(sessionId: string): Promise<void> {
    if (!this.options.onChatMessage || !this.options.chatUserId) {
      return;
    }

    const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        "Client-Id": config.twitch.clientId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "channel.chat.message",
        version: "1",
        condition: {
          broadcaster_user_id: config.twitch.broadcasterUserId,
          user_id: this.options.chatUserId
        },
        transport: {
          method: "websocket",
          session_id: sessionId
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create EventSub subscription: ${response.status} ${await response.text()}`);
    }

    logger.info("Subscribed to channel.chat.message events.");
  }

  private async subscribeToRewardRedemptions(sessionId: string): Promise<void> {
    if (!this.options.onRewardRedemption) {
      return;
    }

    const response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        "Client-Id": config.twitch.clientId,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "channel.channel_points_custom_reward_redemption.add",
        version: "1",
        condition: {
          broadcaster_user_id: config.twitch.broadcasterUserId
        },
        transport: {
          method: "websocket",
          session_id: sessionId
        }
      })
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create reward redemption EventSub subscription: ${response.status} ${await response.text()}`
      );
    }

    logger.info("Subscribed to channel.channel_points_custom_reward_redemption.add events.");
  }

  private resetKeepaliveTimer(ws: WebSocket, keepaliveSeconds?: number | null): void {
    const seconds = keepaliveSeconds ?? this.keepaliveTimeoutSeconds;

    if (ws !== this.socket || !seconds) {
      return;
    }

    if (this.keepaliveTimer) {
      clearTimeout(this.keepaliveTimer);
    }

    this.keepaliveTimer = setTimeout(() => {
      logger.warn("EventSub keepalive timeout reached. Reconnecting...");
      this.scheduleReconnect();
    }, (seconds + 5) * 1000);
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer) {
      return;
    }

    this.clearTimers();
    this.socket?.terminate();

    const delayMs = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;

    logger.info(`Reconnecting to Twitch EventSub in ${delayMs}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect(EVENTSUB_WEBSOCKET_URL, false);
    }, delayMs);
  }

  private clearTimers(): void {
    if (this.keepaliveTimer) {
      clearTimeout(this.keepaliveTimer);
      this.keepaliveTimer = undefined;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
