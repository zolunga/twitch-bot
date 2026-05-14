import type { RewardRedemption } from "../twitch/eventsub.js";
import { logger } from "../utils/logger.js";
import type { RewardHandler } from "./types.js";

export class RewardRouter {
  constructor(private readonly handlers: RewardHandler[]) {}

  async handle(redemption: RewardRedemption): Promise<boolean> {
    const handler = this.handlers.find((candidate) => candidate.canHandle(redemption));

    if (!handler) {
      return false;
    }

    try {
      await handler.handle(redemption);
    } catch (error) {
      logger.error(`Reward handler failed for ${redemption.rewardTitle}`, error);
    }

    return true;
  }
}

