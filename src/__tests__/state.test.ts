import { describe, it, expect } from 'vitest';
import { serializeState, deserializeState, validateState } from '../shared/state';
import type { PetState } from '../shared/types';

const defaults: PetState = {
  energy: 100,
  mood: '开心',
  currentSkin: 'default',
  customImage: '',
  chimeEnabled: true,
  chimeHours: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  chimeMessage: '',
  soundEnabled: true,
  soundPreset: 'dingdong',
  customSound: '',
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
      chimeEnabled: false,
      chimeHours: [9, 10],
      chimeMessage: '自定义消息',
      soundEnabled: true,
      soundPreset: 'bell',
      customSound: '',
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
      chimeEnabled: true,
      chimeHours: [],
      chimeMessage: '',
      soundEnabled: false,
      soundPreset: 'beep',
      customSound: '',
      timestamp: 99999,
    };
    const serialized = serializeState(state);
    expect(serialized.currentSkin).toBe('shark');
    expect(serialized.customImage).toBe('some-image-data');
  });

  it('includes chime fields', () => {
    const state: PetState = {
      energy: 70,
      mood: '开心',
      currentSkin: 'default',
      customImage: '',
      chimeEnabled: false,
      chimeHours: [9, 12, 18],
      chimeMessage: '自定义报时',
      soundEnabled: true,
      soundPreset: 'dingdong',
      customSound: '',
      timestamp: 111,
    };
    const serialized = serializeState(state);
    expect(serialized.chimeEnabled).toBe(false);
    expect(serialized.chimeHours).toEqual([9, 12, 18]);
    expect(serialized.chimeMessage).toBe('自定义报时');
  });

  it('includes sound fields', () => {
    const state: PetState = {
      energy: 60,
      mood: '开心',
      currentSkin: 'default',
      customImage: '',
      chimeEnabled: true,
      chimeHours: [],
      chimeMessage: '',
      soundEnabled: false,
      soundPreset: 'notification',
      customSound: 'data:audio/wav;base64,abc',
      timestamp: 222,
    };
    const serialized = serializeState(state);
    expect(serialized.soundEnabled).toBe(false);
    expect(serialized.soundPreset).toBe('notification');
    expect(serialized.customSound).toBe('data:audio/wav;base64,abc');
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
      chimeEnabled: false,
      chimeHours: [9, 18],
      chimeMessage: '报时',
      soundEnabled: false,
      soundPreset: 'bell',
      customSound: '',
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
    expect(result.chimeEnabled).toBe(true);
    expect(result.chimeHours).toEqual(defaults.chimeHours);
    expect(result.chimeMessage).toBe('');
    expect(result.soundEnabled).toBe(true);
    expect(result.soundPreset).toBe('dingdong');
    expect(result.customSound).toBe('');
  });

  it('fills missing chime fields from old data format', () => {
    const oldData = {
      energy: 80,
      mood: '开心',
      currentSkin: 'default',
      customImage: '',
      timestamp: 555,
    };
    const result = deserializeState(oldData, defaults);
    expect(result.chimeEnabled).toBe(defaults.chimeEnabled);
    expect(result.chimeHours).toEqual(defaults.chimeHours);
    expect(result.chimeMessage).toBe(defaults.chimeMessage);
    expect(result.soundEnabled).toBe(defaults.soundEnabled);
    expect(result.soundPreset).toBe(defaults.soundPreset);
    expect(result.customSound).toBe(defaults.customSound);
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
      chimeEnabled: true,
      chimeHours: [9, 10],
      chimeMessage: '',
      soundEnabled: true,
      soundPreset: 'dingdong',
      customSound: '',
      timestamp: Date.now(),
    };
    expect(validateState(state)).toBe(true);
  });

  it('rejects energy out of range (> 100)', () => {
    expect(
      validateState({
        energy: 150,
        mood: 'ok',
        currentSkin: 'x',
        customImage: '',
        chimeEnabled: true,
        chimeHours: [],
        chimeMessage: '',
        soundEnabled: true,
        soundPreset: '',
        customSound: '',
        timestamp: 0,
      })
    ).toBe(false);
  });

  it('rejects energy out of range (< 0)', () => {
    expect(
      validateState({
        energy: -5,
        mood: 'ok',
        currentSkin: 'x',
        customImage: '',
        chimeEnabled: true,
        chimeHours: [],
        chimeMessage: '',
        soundEnabled: true,
        soundPreset: '',
        customSound: '',
        timestamp: 0,
      })
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
