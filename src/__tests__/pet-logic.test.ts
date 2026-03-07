import { describe, it, expect } from 'vitest';
import {
  clampEnergy,
  updateMood,
  pickRandom,
  getMessagePool,
  buildPetClass,
  resolvePetEmoji,
  calculateMovePosition,
  formatChimeMessage,
  getNextChimeDelay,
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
