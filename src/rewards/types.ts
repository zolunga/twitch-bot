import type { RewardRedemption } from "../twitch/eventsub.js";

export interface RewardHandler {
  canHandle(redemption: RewardRedemption): boolean;
  handle(redemption: RewardRedemption): Promise<void>;
}

