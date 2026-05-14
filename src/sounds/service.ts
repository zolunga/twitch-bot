import { config } from "../config.js";
import { Cooldown, formatRemainingSeconds } from "../utils/cooldown.js";
import { logger } from "../utils/logger.js";
import type { SoundPlayer } from "./player.js";
import type { SoundRegistryEntry } from "./registry.js";

interface RegisteredSound extends SoundRegistryEntry {
  normalizedName: string;
}

export interface PlaySoundRequest {
  soundName: string;
  username: string;
  userId: string;
  bits?: number;
  enforceBits?: boolean;
}

export interface PlaySoundResult {
  ok: boolean;
  reason:
    | "played"
    | "missing"
    | "disabled"
    | "insufficient_bits"
    | "global_cooldown"
    | "user_cooldown"
    | "obs_error";
  message: string;
}

interface SoundServiceOptions {
  player: SoundPlayer;
  registry: SoundRegistryEntry[];
}

export class SoundService {
  private readonly soundsByName: Map<string, RegisteredSound>;
  private readonly globalCooldown = new Cooldown(config.cooldowns.soundGlobalMs);
  private readonly perUserCooldown = new Cooldown(config.cooldowns.soundPerUserMs);

  constructor(private readonly options: SoundServiceOptions) {
    this.soundsByName = new Map(
      options.registry.map((sound) => [
        normalizeSoundName(sound.name),
        {
          ...sound,
          normalizedName: normalizeSoundName(sound.name)
        }
      ])
    );
  }

  listEnabledSoundNames(): string[] {
    return [...this.soundsByName.values()]
      .filter((sound) => sound.enabled)
      .map((sound) => sound.name)
      .sort((left, right) => left.localeCompare(right));
  }

  getEnabledObsSourceNames(): string[] {
    return [...this.soundsByName.values()]
      .filter((sound) => sound.enabled)
      .map((sound) => sound.obsSourceName);
  }

  async playSound({
    soundName,
    username,
    userId,
    bits = 0,
    enforceBits = true
  }: PlaySoundRequest): Promise<PlaySoundResult> {
    const sound = this.soundsByName.get(normalizeSoundName(soundName));

    if (!sound) {
      return {
        ok: false,
        reason: "missing",
        message: `@${username} no existe el sonido "${soundName}". Usa !sounds para ver la lista.`
      };
    }

    if (!sound.enabled) {
      return {
        ok: false,
        reason: "disabled",
        message: `@${username} el sonido "${sound.name}" no esta disponible ahora.`
      };
    }

    if (enforceBits && bits < sound.minBits) {
      return {
        ok: false,
        reason: "insufficient_bits",
        message: `@${username} "${sound.name}" requiere minimo ${sound.minBits} Bits.`
      };
    }

    if (!this.globalCooldown.isReady()) {
      const seconds = formatRemainingSeconds(this.globalCooldown.remainingMs());
      return {
        ok: false,
        reason: "global_cooldown",
        message: `@${username} los sonidos estan en cooldown global. Intenta en ${seconds}s.`
      };
    }

    if (!this.perUserCooldown.isReady(userId)) {
      const seconds = formatRemainingSeconds(this.perUserCooldown.remainingMs(userId));
      return {
        ok: false,
        reason: "user_cooldown",
        message: `@${username} espera ${seconds}s antes de pedir otro sonido.`
      };
    }

    try {
      await this.options.player.play(sound.obsSourceName);
    } catch (error) {
      logger.error(`Failed to play OBS media source ${sound.obsSourceName}`, error);
      return {
        ok: false,
        reason: "obs_error",
        message: `@${username} no pude reproducir "${sound.name}" en OBS.`
      };
    }

    this.globalCooldown.trigger();
    this.perUserCooldown.trigger(userId);

    return {
      ok: true,
      reason: "played",
      message: `@${username} reproduciendo "${sound.name}".`
    };
  }

  async stopAllSounds(): Promise<void> {
    await this.options.player.stop(this.getEnabledObsSourceNames());
  }
}

export function normalizeSoundName(name: string): string {
  return name.trim().toLowerCase();
}
