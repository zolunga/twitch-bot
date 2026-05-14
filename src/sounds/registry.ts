export interface SoundRegistryEntry {
  name: string;
  obsSourceName: string;
  minBits: number;
  enabled: boolean;
}

const defaultSoundRegistry: SoundRegistryEntry[] = [
  {
    name: "risa",
    obsSourceName: "risa",
    minBits: 50,
    enabled: true
  }
];

export const soundRegistry = loadSoundRegistry();

function loadSoundRegistry(): SoundRegistryEntry[] {
  const rawRegistry = process.env.SOUND_REGISTRY_JSON?.trim();

  if (!rawRegistry) {
    return defaultSoundRegistry;
  }

  const parsed = JSON.parse(rawRegistry) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("SOUND_REGISTRY_JSON must be a JSON array.");
  }

  return parsed.map((sound) => {
    const candidate = sound as Partial<SoundRegistryEntry>;
    const entry: SoundRegistryEntry = {
      name: String(candidate.name ?? "").trim(),
      obsSourceName: String(candidate.obsSourceName ?? "").trim(),
      minBits: Number(candidate.minBits ?? 0),
      enabled: candidate.enabled !== false
    };

    if (!entry.name || !entry.obsSourceName || !Number.isFinite(entry.minBits) || entry.minBits < 0) {
      throw new Error("Each sound registry entry needs name, obsSourceName, and non-negative numeric minBits.");
    }

    return entry;
  });
}

