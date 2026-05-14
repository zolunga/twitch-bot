import type { ChatMessage, TwitchChatClient } from "../twitch/chat.js";
import { logger } from "../utils/logger.js";
import type { ChatCommand } from "./types.js";

interface CommandRouterOptions {
  chat: TwitchChatClient;
  commands: ChatCommand[];
}

interface ChatMessageRaw {
  message?: {
    fragments?: ChatMessageFragment[];
  };
}

interface ChatMessageFragment {
  cheermote?: {
    bits?: number | string;
  };
}

export class CommandRouter {
  constructor(private readonly options: CommandRouterOptions) {}

  async handle(message: ChatMessage): Promise<boolean> {
    const invocation = parseCommandInvocation(message);

    if (!invocation) {
      return false;
    }

    const command = this.options.commands.find((candidate) => candidate.names.includes(invocation.commandName));

    if (!command) {
      return false;
    }

    try {
      await command.handle({
        message,
        chat: this.options.chat,
        commandName: invocation.commandName,
        args: invocation.args,
        rawText: invocation.commandText,
        bits: invocation.bits
      });
    } catch (error) {
      logger.error(`Command ${invocation.commandName} failed`, error);
    }

    return true;
  }
}

function parseCommandInvocation(message: ChatMessage):
  | {
      commandName: string;
      commandText: string;
      args: string[];
      bits: number;
    }
  | undefined {
  const text = message.text.trim();
  const cheerBits = bitsFromFragments((message.raw as ChatMessageRaw | undefined)?.message?.fragments);
  const cheerPrefix = /^((?:cheer\d+\s+)+)(.+)$/i.exec(text);
  const commandText = cheerPrefix ? cheerPrefix[2].trim() : text;

  if (!commandText.startsWith("!")) {
    return undefined;
  }

  const [commandName = "", ...args] = commandText.split(/\s+/);
  const textBits = cheerPrefix
    ? [...cheerPrefix[1].matchAll(/cheer(\d+)/gi)].reduce((total, match) => total + Number(match[1] || 0), 0)
    : 0;

  return {
    commandName: commandName.toLowerCase(),
    commandText,
    args,
    bits: Math.max(cheerBits, textBits)
  };
}

function bitsFromFragments(fragments: ChatMessageFragment[] | undefined): number {
  if (!Array.isArray(fragments)) {
    return 0;
  }

  return fragments.reduce((total, fragment) => {
    const bits = Number(fragment.cheermote?.bits ?? 0);
    return total + (Number.isFinite(bits) ? bits : 0);
  }, 0);
}

