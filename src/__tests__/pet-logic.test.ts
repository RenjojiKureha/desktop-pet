import { describe, it, expect } from 'vitest';
import {
  clampEnergy,
  updateMood,
  pickRandom,
  getMessagePool,
  getChatButtonLabel,
  buildPetClass,
  resolvePetEmoji,
  resolvePetDisplay,
  calculateMovePosition,
  formatChimeMessage,
  getNextChimeDelay,
  getChimePresetHours,
  parseCountdownInput,
  formatCountdownDisplay,
  getSoundPresetList,
  parseCustomHoursInput,
} from '../shared/pet-logic';
import type { Messages, Moods, SkinConfig, Thresholds } from '../shared/types';

// ---------- clampEnergy ----------
describe('clampEnergy', () => {
  it('adds positive delta', () => {
    expect(clampEnergy(50, 10)).toBe(60);
  });

  it('subtracts negative delta', () => {
    expect(clampEnergy(50, -20)).toBe(30);
  });

  it('clamps at max (100)', () => {
    expect(clampEnergy(95, 10)).toBe(100);
  });

  it('clamps at min (0)', () => {
    expect(clampEnergy(5, -10)).toBe(0);
  });

  it('respects custom min/max', () => {
    expect(clampEnergy(50, 60, 10, 80)).toBe(80);
    expect(clampEnergy(50, -50, 10, 80)).toBe(10);
  });
});

// ---------- updateMood ----------
describe('updateMood', () => {
  const moods: Moods = {
    happy: ['开心', '兴奋'],
    normal: ['平静'],
    tired: ['疲惫', '困倦'],
    lowEnergy: '疲惫',
  };
  const thresholds: Thresholds = { tiredMood: 30, noAutoMove: 10, canAutoMove: 20 };

  it('returns a tired mood when energy <= tiredMood threshold', () => {
    const result = updateMood(20, thresholds, moods);
    expect(moods.tired).toContain(result);
  });

  it('returns a happy mood when energy > tiredMood threshold', () => {
    const result = updateMood(80, thresholds, moods);
    expect(moods.happy).toContain(result);
  });

  it('boundary: energy exactly at threshold → tired', () => {
    const result = updateMood(30, thresholds, moods);
    expect(moods.tired).toContain(result);
  });

  it('boundary: energy just above threshold → happy', () => {
    const result = updateMood(31, thresholds, moods);
    expect(moods.happy).toContain(result);
  });
});

// ---------- pickRandom ----------
describe('pickRandom', () => {
  it('returns an element from the array', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = pickRandom(arr);
    expect(arr).toContain(result);
  });

  it('returns undefined for empty array', () => {
    expect(pickRandom([])).toBeUndefined();
  });

  it('returns the only element for single-element array', () => {
    expect(pickRandom(['only'])).toBe('only');
  });
});

// ---------- getMessagePool ----------
describe('getMessagePool', () => {
  const messages: Messages = {
    click: ['click1', 'click2'],
    idle: ['idle1'],
    lowEnergy: ['low1'],
    moving: ['move1'],
  };

  it('returns click pool', () => {
    expect(getMessagePool('click', messages)).toEqual(['click1', 'click2']);
  });

  it('returns idle pool', () => {
    expect(getMessagePool('idle', messages)).toEqual(['idle1']);
  });

  it('returns moving pool', () => {
    expect(getMessagePool('moving', messages)).toEqual(['move1']);
  });

  it('returns lowEnergy pool', () => {
    expect(getMessagePool('lowEnergy', messages)).toEqual(['low1']);
  });

  it('"all" returns merged click+idle+moving pool', () => {
    const pool = getMessagePool('all', messages);
    expect(pool).toEqual(['click1', 'click2', 'idle1', 'move1']);
  });

  it('"chat" returns click pool (reuses click messages)', () => {
    expect(getMessagePool('chat', messages)).toEqual(['click1', 'click2']);
  });
});

// ---------- getChatButtonLabel ----------
describe('getChatButtonLabel', () => {
  const thresholds: Thresholds = { tiredMood: 30, noAutoMove: 10, canAutoMove: 20 };

  it('returns 💬 when energy > canAutoMove', () => {
    expect(getChatButtonLabel(80, thresholds)).toBe('💬');
  });

  it('returns 💤 when energy <= tiredMood', () => {
    expect(getChatButtonLabel(20, thresholds)).toBe('💤');
  });

  it('returns 💤 at tiredMood boundary', () => {
    expect(getChatButtonLabel(30, thresholds)).toBe('💤');
  });

  it('returns 💬 for middle state (between tiredMood and canAutoMove)', () => {
    expect(getChatButtonLabel(31, thresholds)).toBe('💬');
  });
});

// ---------- buildPetClass ----------
describe('buildPetClass', () => {
  const thresholds: Thresholds = { tiredMood: 30, noAutoMove: 10, canAutoMove: 20 };

  it('active animation → only that animation class', () => {
    expect(
      buildPetClass({
        currentAnimation: 'jumping',
        energy: 80,
        isHovering: false,
        isAutoMoving: false,
        moveDirection: '',
        thresholds,
      })
    ).toBe('jumping');
  });

  it('no animation + low energy → breathing sleepy', () => {
    expect(
      buildPetClass({
        currentAnimation: '',
        energy: 20,
        isHovering: false,
        isAutoMoving: false,
        moveDirection: '',
        thresholds,
      })
    ).toBe('breathing sleepy');
  });

  it('no animation + hovering → breathing swaying', () => {
    expect(
      buildPetClass({
        currentAnimation: '',
        energy: 80,
        isHovering: true,
        isAutoMoving: false,
        moveDirection: '',
        thresholds,
      })
    ).toBe('breathing swaying');
  });

  it('auto-moving right → crawling-right class', () => {
    const result = buildPetClass({
      currentAnimation: '',
      energy: 80,
      isHovering: false,
      isAutoMoving: true,
      moveDirection: '向右',
      thresholds,
    });
    expect(result).toContain('crawling-right');
  });

  it('auto-moving left → crawling-left class', () => {
    const result = buildPetClass({
      currentAnimation: '',
      energy: 80,
      isHovering: false,
      isAutoMoving: true,
      moveDirection: '向左',
      thresholds,
    });
    expect(result).toContain('crawling-left');
  });

  it('auto-moving with enough energy → includes breathing', () => {
    const result = buildPetClass({
      currentAnimation: '',
      energy: 80,
      isHovering: false,
      isAutoMoving: true,
      moveDirection: '向右',
      thresholds,
    });
    expect(result).toContain('breathing');
  });
});

// ---------- resolvePetEmoji ----------
describe('resolvePetEmoji', () => {
  const skinConfig: SkinConfig = {
    enabled: true,
    type: 'emoji',
    customImage: '',
    skins: [
      { id: 'default', name: '默认', type: 'emoji', value: '🐟' },
      { id: 'nemo', name: '尼莫', type: 'emoji', value: '🐠' },
    ],
    currentSkin: 'default',
  };

  it('returns emoji for valid skin id', () => {
    expect(resolvePetEmoji(skinConfig, 'nemo', '🦞')).toBe('🐠');
  });

  it('returns default emoji for invalid skin id', () => {
    expect(resolvePetEmoji(skinConfig, 'nonexistent', '🦞')).toBe('🦞');
  });

  it('returns default emoji when skin is disabled', () => {
    const disabled = { ...skinConfig, enabled: false };
    expect(resolvePetEmoji(disabled, 'nemo', '🦞')).toBe('🦞');
  });
});

// ---------- calculateMovePosition ----------
describe('calculateMovePosition', () => {
  it('moves right within bounds', () => {
    const newX = calculateMovePosition(100, 'right', 1920, 300);
    expect(newX).toBeGreaterThan(100);
    expect(newX).toBeLessThanOrEqual(1920 - 300);
  });

  it('moves left within bounds', () => {
    const newX = calculateMovePosition(500, 'left', 1920, 300);
    expect(newX).toBeLessThan(500);
    expect(newX).toBeGreaterThanOrEqual(0);
  });

  it('does not exceed screen width', () => {
    const newX = calculateMovePosition(1700, 'right', 1920, 300);
    expect(newX).toBeLessThanOrEqual(1920 - 300);
  });

  it('does not go below 0', () => {
    const newX = calculateMovePosition(10, 'left', 1920, 300);
    expect(newX).toBeGreaterThanOrEqual(0);
  });
});

// ---------- formatChimeMessage ----------
describe('formatChimeMessage', () => {
  it('replaces {hour}, {period}, and {action}', () => {
    const result = formatChimeMessage('现在是 {hour} 点啦！{period} {action}', 14, '喝水');
    expect(result).toBe('现在是 2 点啦！下午 喝水');
  });

  it('handles morning hours', () => {
    const result = formatChimeMessage('{period} {hour} 点 {action}', 9, '加油');
    expect(result).toBe('上午 9 点 加油');
  });

  it("handles 12 o'clock as 12 (afternoon)", () => {
    const result = formatChimeMessage('{hour} {period}', 12, '');
    expect(result).toBe('12 下午');
  });
});

// ---------- getNextChimeDelay ----------
describe('getNextChimeDelay', () => {
  it('returns ms until next chime hour', () => {
    // 9:30 → next chime at 10:00 → 30 minutes = 1800000ms
    const now = new Date(2026, 2, 7, 9, 30, 0, 0);
    const delay = getNextChimeDelay(now, [10, 11, 12]);
    expect(delay).toBe(30 * 60 * 1000);
  });

  it('wraps to next day if no more chimes today', () => {
    // 22:30 → next chime at 8:00 next day
    const now = new Date(2026, 2, 7, 22, 30, 0, 0);
    const delay = getNextChimeDelay(now, [8, 9, 10]);
    // 22:30 → next day 8:00 = 9.5 hours = 34200000ms
    expect(delay).toBe(9.5 * 60 * 60 * 1000);
  });

  it('returns null for empty chime hours', () => {
    const now = new Date(2026, 2, 7, 10, 0, 0, 0);
    expect(getNextChimeDelay(now, [])).toBeNull();
  });

  it('if exactly at a chime hour, returns delay to next one', () => {
    // exactly 10:00 → next is 11:00 → 60 min
    const now = new Date(2026, 2, 7, 10, 0, 0, 0);
    const delay = getNextChimeDelay(now, [10, 11, 12]);
    expect(delay).toBe(60 * 60 * 1000);
  });
});

// ---------- resolvePetDisplay ----------
describe('resolvePetDisplay', () => {
  const skinConfig: SkinConfig = {
    enabled: true,
    type: 'emoji',
    customImage: '',
    skins: [
      { id: 'default', name: '默认', type: 'emoji', value: '🐟' },
      { id: 'nemo', name: '尼莫', type: 'emoji', value: '🐠' },
    ],
    currentSkin: 'default',
  };

  it('returns image display when customImage is set', () => {
    const result = resolvePetDisplay(skinConfig, 'default', '🐟', 'data:image/png;base64,abc');
    expect(result).toEqual({ type: 'image', src: 'data:image/png;base64,abc' });
  });

  it('returns emoji display when customImage is empty', () => {
    const result = resolvePetDisplay(skinConfig, 'nemo', '🐟', '');
    expect(result).toEqual({ type: 'emoji', value: '🐠' });
  });

  it('returns default emoji when skin is disabled and no custom image', () => {
    const disabled = { ...skinConfig, enabled: false };
    const result = resolvePetDisplay(disabled, 'nemo', '🦞', '');
    expect(result).toEqual({ type: 'emoji', value: '🦞' });
  });

  it('custom image takes priority over emoji skin', () => {
    const result = resolvePetDisplay(skinConfig, 'nemo', '🐟', 'data:image/jpeg;base64,xyz');
    expect(result.type).toBe('image');
  });

  it('returns emoji when customImage is cleared after switching back', () => {
    const result = resolvePetDisplay(skinConfig, 'default', '🐟', '');
    expect(result).toEqual({ type: 'emoji', value: '🐟' });
  });
});

// ---------- getChimePresetHours ----------
describe('getChimePresetHours', () => {
  it("'work' returns hours 9-18", () => {
    expect(getChimePresetHours('work')).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it("'daytime' returns hours 8-22", () => {
    expect(getChimePresetHours('daytime')).toEqual([
      8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
    ]);
  });

  it("'allday' returns hours 0-23", () => {
    const expected = Array.from({ length: 24 }, (_, i) => i);
    expect(getChimePresetHours('allday')).toEqual(expected);
  });

  it('unknown preset returns empty array', () => {
    expect(getChimePresetHours('unknown')).toEqual([]);
  });
});

// ---------- parseCountdownInput ----------
describe('parseCountdownInput', () => {
  it("parses '10' as 10", () => {
    expect(parseCountdownInput('10')).toBe(10);
  });

  it("parses '1' as 1", () => {
    expect(parseCountdownInput('1')).toBe(1);
  });

  it("returns null for 'abc'", () => {
    expect(parseCountdownInput('abc')).toBeNull();
  });

  it("returns null for '0'", () => {
    expect(parseCountdownInput('0')).toBeNull();
  });

  it('returns null for negative number', () => {
    expect(parseCountdownInput('-5')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCountdownInput('')).toBeNull();
  });

  it('returns null for values exceeding 120', () => {
    expect(parseCountdownInput('121')).toBeNull();
  });

  it("parses '120' as 120 (upper bound)", () => {
    expect(parseCountdownInput('120')).toBe(120);
  });
});

// ---------- formatCountdownDisplay ----------
describe('formatCountdownDisplay', () => {
  it('formats 90000ms as 1:30', () => {
    expect(formatCountdownDisplay(90000)).toBe('1:30');
  });

  it('formats 60000ms as 1:00', () => {
    expect(formatCountdownDisplay(60000)).toBe('1:00');
  });

  it('formats 5000ms as 0:05', () => {
    expect(formatCountdownDisplay(5000)).toBe('0:05');
  });

  it('formats 0ms as 0:00', () => {
    expect(formatCountdownDisplay(0)).toBe('0:00');
  });

  it('formats 3599000ms as 59:59', () => {
    expect(formatCountdownDisplay(3599000)).toBe('59:59');
  });
});

// ---------- getSoundPresetList ----------
describe('getSoundPresetList', () => {
  it('returns a non-empty array', () => {
    const presets = getSoundPresetList();
    expect(presets.length).toBeGreaterThan(0);
  });

  it('each preset has id and name', () => {
    const presets = getSoundPresetList();
    presets.forEach(p => {
      expect(typeof p.id).toBe('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
    });
  });

  it('preset ids are unique', () => {
    const presets = getSoundPresetList();
    const ids = presets.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------- parseCustomHoursInput ----------
describe('parseCustomHoursInput', () => {
  it('parses comma-separated hours', () => {
    expect(parseCustomHoursInput('9,12,15,18')).toEqual([9, 12, 15, 18]);
  });

  it('filters non-numeric values', () => {
    expect(parseCustomHoursInput('9,abc,15')).toEqual([9, 15]);
  });

  it('filters out-of-range values (>23 or <0)', () => {
    expect(parseCustomHoursInput('9,25,-1,18')).toEqual([9, 18]);
  });

  it('returns sorted unique values', () => {
    expect(parseCustomHoursInput('18,9,9,12')).toEqual([9, 12, 18]);
  });

  it('returns null for completely invalid input', () => {
    expect(parseCustomHoursInput('abc,def')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseCustomHoursInput('')).toBeNull();
  });

  it('handles spaces around numbers', () => {
    expect(parseCustomHoursInput(' 9 , 12 , 18 ')).toEqual([9, 12, 18]);
  });
});
