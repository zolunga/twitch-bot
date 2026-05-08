import { config } from "../config.js";

export interface StreamContext {
  title: string;
  gameName: string;
  tags: string[];
  isLive: boolean;
  viewerCount?: number;
  startedAt?: string;
}

interface TwitchChannelResponse {
  data: Array<{
    title: string;
    game_name: string;
    tags?: string[];
  }>;
}

interface TwitchStreamsResponse {
  data: Array<{
    title: string;
    game_name: string;
    tags?: string[];
    viewer_count: number;
    started_at: string;
    type: string;
  }>;
}

export class TwitchApiClient {
  private cachedStreamContext?: StreamContext;
  private cachedAt = 0;

  async getStreamContext(): Promise<StreamContext | undefined> {
    const now = Date.now();

    if (this.cachedStreamContext && now - this.cachedAt < config.stream.contextCacheMs) {
      return this.cachedStreamContext;
    }

    const [channel, stream] = await Promise.all([this.getChannelInformation(), this.getLiveStream()]);
    const live = stream.data[0];
    const channelInfo = channel.data[0];

    if (!channelInfo && !live) {
      return undefined;
    }

    this.cachedStreamContext = {
      title: live?.title || channelInfo?.title || "",
      gameName: live?.game_name || channelInfo?.game_name || "",
      tags: live?.tags?.length ? live.tags : channelInfo?.tags ?? [],
      isLive: live?.type === "live",
      viewerCount: live?.viewer_count,
      startedAt: live?.started_at
    };
    this.cachedAt = now;

    return this.cachedStreamContext;
  }

  private async getChannelInformation(): Promise<TwitchChannelResponse> {
    return this.getHelix<TwitchChannelResponse>(
      `channels?broadcaster_id=${encodeURIComponent(config.twitch.broadcasterUserId)}`
    );
  }

  private async getLiveStream(): Promise<TwitchStreamsResponse> {
    return this.getHelix<TwitchStreamsResponse>(
      `streams?user_id=${encodeURIComponent(config.twitch.broadcasterUserId)}`
    );
  }

  private async getHelix<T>(path: string): Promise<T> {
    const response = await fetch(`https://api.twitch.tv/helix/${path}`, {
      headers: {
        Authorization: `Bearer ${config.twitch.botAccessToken}`,
        "Client-Id": config.twitch.clientId
      }
    });

    if (!response.ok) {
      throw new Error(`Twitch API request failed: ${response.status} ${await response.text()}`);
    }

    return response.json() as Promise<T>;
  }
}
