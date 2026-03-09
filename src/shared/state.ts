import type { PetState, SerializedState } from './types';

/** Serialize full pet state (includes skin data — fixes bug #6). */
export function serializeState(state: PetState): SerializedState {
  return {
    energy: state.energy,
    mood: state.mood,
    currentSkin: state.currentSkin,
    customImage: state.customImage,
    chimeEnabled: state.chimeEnabled,
    chimeHours: state.chimeHours,
    chimeMessage: state.chimeMessage,
    soundEnabled: state.soundEnabled,
    soundPreset: state.soundPreset,
    customSound: state.customSound,
    timestamp: state.timestamp,
  };
}

/** Deserialize state from disk, merging with defaults for missing fields. */
export function deserializeState(data: unknown, defaults: PetState): PetState {
  if (!data || typeof data !== 'object') return { ...defaults };

  const raw = data as Record<string, unknown>;
  return {
    energy: typeof raw.energy === 'number' ? raw.energy : defaults.energy,
    mood: typeof raw.mood === 'string' ? raw.mood : defaults.mood,
    currentSkin: typeof raw.currentSkin === 'string' ? raw.currentSkin : defaults.currentSkin,
    customImage: typeof raw.customImage === 'string' ? raw.customImage : defaults.customImage,
    chimeEnabled: typeof raw.chimeEnabled === 'boolean' ? raw.chimeEnabled : defaults.chimeEnabled,
    chimeHours: Array.isArray(raw.chimeHours) ? raw.chimeHours : defaults.chimeHours,
    chimeMessage: typeof raw.chimeMessage === 'string' ? raw.chimeMessage : defaults.chimeMessage,
    soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : defaults.soundEnabled,
    soundPreset: typeof raw.soundPreset === 'string' ? raw.soundPreset : defaults.soundPreset,
    customSound: typeof raw.customSound === 'string' ? raw.customSound : defaults.customSound,
    timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : defaults.timestamp,
  };
}

/** Type-guard: validate that an unknown value is a valid PetState. */
export function validateState(state: unknown): state is PetState {
  if (!state || typeof state !== 'object') return false;

  const s = state as Record<string, unknown>;

  if (typeof s.energy !== 'number' || s.energy < 0 || s.energy > 100) return false;
  if (typeof s.mood !== 'string') return false;
  if (typeof s.currentSkin !== 'string') return false;
  if (typeof s.customImage !== 'string') return false;
  if (typeof s.chimeEnabled !== 'boolean') return false;
  if (!Array.isArray(s.chimeHours)) return false;
  if (typeof s.chimeMessage !== 'string') return false;
  if (typeof s.soundEnabled !== 'boolean') return false;
  if (typeof s.soundPreset !== 'string') return false;
  if (typeof s.customSound !== 'string') return false;
  if (typeof s.timestamp !== 'number') return false;

  return true;
}
