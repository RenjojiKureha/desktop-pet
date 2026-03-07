import { describe, it, expect } from 'vitest';
import { serializeState, deserializeState, validateState } from '../shared/state';
import type { PetState } from '../shared/types';

const defaults: PetState = {
  energy: 100,
  mood: '开心',
  currentSkin: 'default',
  customImage: '',
  timestamp: 0,
};

// ---------- serializeState ----------
describe('serializeState', () => {
  it('includes all required fields', () => {
    const state: PetState = {
      energy: 80,
      mood: '兴奋',
      currentSkin: 'nemo',
      customImage: 'data:image/png;base64,abc',
      timestamp: 12345,
    };
    const serialized = serializeState(state);
    expect(serialized).toEqual(state);
  });

  it('includes currentSkin and customImage (bug #6 fix)', () => {
    const state: PetState = {
      energy: 50,
      mood: '平静',
      currentSkin: 'shark',
      customImage: 'some-image-data',
      timestamp: 99999,
    };
    const serialized = serializeState(state);
    expect(serialized.currentSkin).toBe('shark');
    expect(serialized.customImage).toBe('some-image-data');
  });
});

// ---------- deserializeState ----------
describe('deserializeState', () => {
  it('returns full state from valid data', () => {
    const data = {
      energy: 60,
      mood: '疲惫',
      currentSkin: 'whale',
      customImage: '',
      timestamp: 100,
    };
    expect(deserializeState(data, defaults)).toEqual(data);
  });

  it('fills missing fields with defaults', () => {
    const data = { energy: 40 };
    const result = deserializeState(data, defaults);
    expect(result.energy).toBe(40);
    expect(result.mood).toBe('开心');
    expect(result.currentSkin).toBe('default');
    expect(result.customImage).toBe('');
  });

  it('returns defaults for null input', () => {
    expect(deserializeState(null, defaults)).toEqual(defaults);
  });

  it('returns defaults for undefined input', () => {
    expect(deserializeState(undefined, defaults)).toEqual(defaults);
  });

  it('returns defaults for non-object input', () => {
    expect(deserializeState('invalid', defaults)).toEqual(defaults);
  });
});

// ---------- validateState ----------
describe('validateState', () => {
  it('accepts valid state', () => {
    const state: PetState = {
      energy: 50,
      mood: '开心',
      currentSkin: 'default',
      customImage: '',
      timestamp: Date.now(),
    };
    expect(validateState(state)).toBe(true);
  });

  it('rejects energy out of range (> 100)', () => {
    expect(
      validateState({ energy: 150, mood: 'ok', currentSkin: 'x', customImage: '', timestamp: 0 })
    ).toBe(false);
  });

  it('rejects energy out of range (< 0)', () => {
    expect(
      validateState({ energy: -5, mood: 'ok', currentSkin: 'x', customImage: '', timestamp: 0 })
    ).toBe(false);
  });

  it('rejects non-object', () => {
    expect(validateState(null)).toBe(false);
    expect(validateState('string')).toBe(false);
    expect(validateState(42)).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(validateState({ energy: 50 })).toBe(false);
  });
});
