import { describe, it, expect } from 'vitest';
import { mergeWithDefaults, getAnimationDuration } from '../shared/config';
import type { AnimationDurations } from '../shared/types';

// ---------- mergeWithDefaults ----------
describe('mergeWithDefaults', () => {
  const defaults = {
    a: 1,
    b: 'hello',
    c: true,
  };

  it('overrides matching keys', () => {
    const result = mergeWithDefaults({ a: 99 }, defaults);
    expect(result.a).toBe(99);
    expect(result.b).toBe('hello');
    expect(result.c).toBe(true);
  });

  it('keeps all defaults for empty partial', () => {
    const result = mergeWithDefaults({}, defaults);
    expect(result).toEqual(defaults);
  });

  it('returns defaults when partial is null/undefined', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(mergeWithDefaults(null as any, defaults)).toEqual(defaults);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(mergeWithDefaults(undefined as any, defaults)).toEqual(defaults);
  });
});

// ---------- getAnimationDuration ----------
describe('getAnimationDuration', () => {
  const durations: AnimationDurations = {
    breatheDuration: 2000,
    jumpDuration: 600,
    happyDuration: 800,
    swayDuration: 3000,
    sleepyDuration: 1500,
    crawlDuration: 800,
  };

  it('returns duration for existing animation', () => {
    expect(getAnimationDuration(durations, 'jumping')).toBe(600);
    expect(getAnimationDuration(durations, 'happy')).toBe(800);
    expect(getAnimationDuration(durations, 'breathing')).toBe(2000);
  });

  it('returns default 1000 for unknown animation', () => {
    expect(getAnimationDuration(durations, 'unknown')).toBe(1000);
  });

  it('returns default 1000 for empty string', () => {
    expect(getAnimationDuration(durations, '')).toBe(1000);
  });
});
