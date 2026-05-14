import { config } from "../config.js";
import type { SoundService } from "../sounds/service.js";
import type { ChatMessage } from "../twitch/chat.js";
import type { ChatCommand, ChatCommandContext } from "./types.js";

interface SoundCommandOptions {
  sounds: SoundService;
}

interface ChatMessageRaw {
  badges?: Array<{
    set_id?: string;
  }>;
}

export class SoundCommand implements ChatCommand {
  readonly names = ["!sound", "!sounds"];

  constructor(private readonly options: SoundCommandOptions) {}

  async handle(context: ChatCommandContext): Promise<void> {
    if (context.commandName === "!sounds") {
      await this.handleSoundsList(context);
      return;
    }

    const soundName = context.args.join(" ").trim();

    if (!soundName) {
      await context.chat.say(`@${context.message.username} uso: !sound <nombre>`, context.message.id);
      return;
    }

    if (soundName.toLowerCase() === "stop") {
      await this.handleStop(context);
      return;
    }

    await this.handleSound(context, soundName);
  }

  private async handleSoundsList({ chat, message }: ChatCommandContext): Promise<void> {
    const sounds = this.options.sounds.listEnabledSoundNames();
    const response = sounds.length ? `Sonidos disponibles: ${sounds.join(", ")}` : "No hay sonidos disponibles ahora.";

    await chat.say(response, message.id);
  }

  private async handleStop({ chat, message }: ChatCommandContext): Promise<void> {
    if (!isBroadcasterOrMod(message)) {
      await chat.say(`@${message.username} solo broadcaster/mods pueden detener sonidos.`, message.id);
      return;
    }

    try {
      await this.options.sounds.stopAllSounds();
      await chat.say(`@${message.username} sonidos detenidos.`, message.id);
    } catch {
      await chat.say(`@${message.username} no pude detener los sonidos en OBS.`, message.id);
    }
  }

  private async handleSound({ chat, message, bits }: ChatCommandContext, soundName: string): Promise<void> {
    const privileged = isBroadcasterOrMod(message);
    const result = await this.options.sounds.playSound({
      soundName,
      username: message.username,
      userId: message.userId,
      bits,
      enforceBits: !privileged
    });

    await chat.say(result.message, message.id);
  }
}

function isBroadcasterOrMod(message: ChatMessage): boolean {
  if (message.userId === config.twitch.broadcasterUserId) {
    return true;
  }

  const raw = message.raw as ChatMessageRaw | undefined;
  const badges = raw?.badges ?? [];
  return badges.some((badge) => badge.set_id === "broadcaster" || badge.set_id === "moderator");
}

