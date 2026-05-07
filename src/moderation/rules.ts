import type { ChatMessage } from "../twitch/chat.js";

export interface ModerationAlert {
  reason: string;
}

interface UserMessageState {
  lastText: string;
  repeatCount: number;
  lastSeenAt: number;
}

const REPEAT_WINDOW_MS = 30_000;

const PROMO_PHRASES = [
  "buy followers",
  "promote your channel",
  "viewers guaranteed",
  "cheap viewers"
];

const LINK_PATTERN =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\/?\S*/i;

export class ModerationRules {
  private readonly userMessageState = new Map<string, UserMessageState>();

  inspect(message: ChatMessage): ModerationAlert[] {
    const alerts: ModerationAlert[] = [];
    const normalized = normalize(message.text);

    if (!normalized) {
      return alerts;
    }

    const promoPhrase = PROMO_PHRASES.find((phrase) => normalized.includes(phrase));
    if (promoPhrase) {
      alerts.push({ reason: `suspicious promo phrase "${promoPhrase}"` });
    }

    if (LINK_PATTERN.test(normalized)) {
      alerts.push({ reason: "suspicious link" });
    }

    if (this.isRepeatedMessage(message.userId, normalized)) {
      alerts.push({ reason: "repeated message from same user" });
    }

    return alerts;
  }

  private isRepeatedMessage(userId: string, normalizedText: string): boolean {
    const now = Date.now();
    const previous = this.userMessageState.get(userId);

    if (!previous || now - previous.lastSeenAt > REPEAT_WINDOW_MS || previous.lastText !== normalizedText) {
      this.userMessageState.set(userId, {
        lastText: normalizedText,
        repeatCount: 1,
        lastSeenAt: now
      });
      return false;
    }

    previous.repeatCount += 1;
    previous.lastSeenAt = now;
    return previous.repeatCount >= 2;
  }
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
