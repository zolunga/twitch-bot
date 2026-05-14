import type { ChatCommand, ChatCommandContext } from "./types.js";

export class PingCommand implements ChatCommand {
  readonly names = ["!ping"];

  async handle({ chat, message }: ChatCommandContext): Promise<void> {
    await chat.say("pong", message.id);
  }
}

export class HolaCommand implements ChatCommand {
  readonly names = ["!hola"];

  async handle({ chat, message }: ChatCommandContext): Promise<void> {
    await chat.say(`Hola @${message.username}!`, message.id);
  }
}

export class HelpCommand implements ChatCommand {
  readonly names = ["!help"];

  async handle({ chat, message }: ChatCommandContext): Promise<void> {
    await chat.say("Comandos: !ping, !hola, !redes, !ask <pregunta>, !sounds, !sound <nombre>, !help", message.id);
  }
}

