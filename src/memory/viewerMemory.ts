import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChatMessage } from "../twitch/chat.js";
import { logger } from "../utils/logger.js";

export interface ViewerRecord {
  userId: string;
  username: string;
  userLogin: string;
  firstSeenAt: string;
  lastSeenAt: string;
  messageCount: number;
  commandCount: number;
  welcomedAt?: string;
}

interface ViewerMemoryFile {
  viewers: Record<string, ViewerRecord>;
}

export interface ViewerMessageUpdate {
  record: ViewerRecord;
  isFirstSeen: boolean;
}

export class ViewerMemory {
  private readonly filePath = path.join(process.cwd(), "data", "viewers.json");
  private viewers = new Map<string, ViewerRecord>();
  private writeQueue = Promise.resolve();

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as ViewerMemoryFile;
      this.viewers = new Map(Object.entries(parsed.viewers ?? {}));
      logger.info(`Loaded viewer memory for ${this.viewers.size} viewers.`);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        logger.info("Viewer memory file not found. Starting with empty memory.");
        return;
      }

      logger.warn("Could not load viewer memory. Starting with empty memory.", error);
    }
  }

  async recordMessage(message: ChatMessage): Promise<ViewerMessageUpdate> {
    const now = new Date().toISOString();
    const existing = this.viewers.get(message.userId);
    const isCommand = message.text.trim().startsWith("!");

    if (existing) {
      existing.username = message.username;
      existing.userLogin = message.userLogin;
      existing.lastSeenAt = now;
      existing.messageCount += 1;
      existing.commandCount += isCommand ? 1 : 0;
      await this.saveSoon();
      return { record: existing, isFirstSeen: false };
    }

    const record: ViewerRecord = {
      userId: message.userId,
      username: message.username,
      userLogin: message.userLogin,
      firstSeenAt: now,
      lastSeenAt: now,
      messageCount: 1,
      commandCount: isCommand ? 1 : 0
    };

    this.viewers.set(message.userId, record);
    await this.saveSoon();

    return { record, isFirstSeen: true };
  }

  async markWelcomed(userId: string): Promise<void> {
    const record = this.viewers.get(userId);

    if (!record || record.welcomedAt) {
      return;
    }

    record.welcomedAt = new Date().toISOString();
    await this.saveSoon();
  }

  private async saveSoon(): Promise<void> {
    this.writeQueue = this.writeQueue
      .then(async () => {
        await mkdir(path.dirname(this.filePath), { recursive: true });
        await writeFile(
          this.filePath,
          `${JSON.stringify({ viewers: Object.fromEntries(this.viewers) } satisfies ViewerMemoryFile, null, 2)}\n`,
          "utf8"
        );
      })
      .catch((error) => {
        logger.error("Failed to write viewer memory", error);
      });

    await this.writeQueue;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
