import type { ObsService } from "../obs/service.js";
import type { SoundPlayer } from "./player.js";

export class ObsSoundPlayer implements SoundPlayer {
  constructor(private readonly obs: ObsService) {}

  async play(sourceName: string): Promise<void> {
    await this.obs.restartMediaInput(sourceName);
  }

  async stop(sourceNames: string[]): Promise<void> {
    await this.obs.stopMediaInputs(sourceNames);
  }
}

