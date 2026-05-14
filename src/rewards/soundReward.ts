import type { SoundService } from "../sounds/service.js";
import type { TwitchChatClient } from "../twitch/chat.js";
import type { RewardRedemption } from "../twitch/eventsub.js";
import type { RewardHandler } from "./types.js";

interface SoundRewardOptions {
  chat: TwitchChatClient;
  sounds: SoundService;
  rewardTitle: string;
}

export class SoundReward implements RewardHandler {
  constructor(private readonly options: SoundRewardOptions) {}

  canHandle(redemption: RewardRedemption): boolean {
    return redemption.rewardTitle === this.options.rewardTitle;
  }

  async handle(redemption: RewardRedemption): Promise<void> {
    const soundName = redemption.userInput.trim();

    if (!soundName) {
      await this.options.chat.say(`@${redemption.username} escribe el nombre del sonido en la recompensa.`);
      return;
    }

    const result = await this.options.sounds.playSound({
      soundName,
      username: redemption.username,
      userId: redemption.userId,
      enforceBits: false
    });

    await this.options.chat.say(result.message);
  }
}

