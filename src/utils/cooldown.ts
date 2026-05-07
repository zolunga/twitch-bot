export class Cooldown {
  private readonly expiresAtByKey = new Map<string, number>();

  constructor(private readonly durationMs: number) {}

  isReady(key = "global"): boolean {
    return this.remainingMs(key) <= 0;
  }

  remainingMs(key = "global"): number {
    const expiresAt = this.expiresAtByKey.get(key) ?? 0;
    return Math.max(0, expiresAt - Date.now());
  }

  trigger(key = "global"): void {
    this.expiresAtByKey.set(key, Date.now() + this.durationMs);
  }

  tryAcquire(key = "global"): boolean {
    if (!this.isReady(key)) {
      return false;
    }

    this.trigger(key);
    return true;
  }
}

export function formatRemainingSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}
