export interface SoundPlayer {
  play(sourceName: string): Promise<void>;
  stop(sourceNames: string[]): Promise<void>;
}

