import type { AnimationDurations } from './types';

/** Merge a partial config object with defaults (shallow). */
export function mergeWithDefaults<T extends Record<string, unknown>>(
  partial: Partial<T> | null | undefined,
  defaults: T
): T {
  if (!partial || typeof partial !== 'object') return { ...defaults };
  return { ...defaults, ...partial };
}

/** Map animation name → duration key. */
const animDurationKey: Record<string, keyof AnimationDurations> = {
  breathing: 'breatheDuration',
  jumping: 'jumpDuration',
  happy: 'happyDuration',
  swaying: 'swayDuration',
  sleepy: 'sleepyDuration',
  'crawling-right': 'crawlDuration',
  'crawling-left': 'crawlDuration',
};

/** Get the duration for a named animation, falling back to 1000ms. */
export function getAnimationDuration(durations: AnimationDurations, animName: string): number {
  const key = animDurationKey[animName];
  if (key && durations[key] != null) return durations[key];
  return 1000;
}
