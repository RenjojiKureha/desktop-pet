import type {
  BuildPetClassOpts,
  Messages,
  MessageType,
  Moods,
  PetDisplay,
  SkinConfig,
  Thresholds,
} from './types';

/** Clamp energy after applying a delta. */
export function clampEnergy(energy: number, delta: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, energy + delta));
}

/** Pick a mood string based on current energy level. */
export function updateMood(energy: number, thresholds: Thresholds, moods: Moods): string {
  if (energy <= thresholds.tiredMood) {
    return pickRandom(moods.tired) ?? moods.lowEnergy;
  }
  return pickRandom(moods.happy) ?? '开心';
}

/** Return a random element from an array (undefined if empty). */
export function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Return the message pool for a given type. */
export function getMessagePool(type: MessageType, messages: Messages): string[] {
  if (type === 'all') {
    return [...messages.click, ...messages.idle, ...messages.moving];
  }
  if (type === 'chat') {
    return messages.click;
  }
  return messages[type] ?? [];
}

/** Return the chat button label based on energy level. */
export function getChatButtonLabel(energy: number, thresholds: Thresholds): string {
  if (energy <= thresholds.tiredMood) return '💤';
  return '💬';
}

/** Build the CSS class string for the pet element. */
export function buildPetClass(opts: BuildPetClassOpts): string {
  const { currentAnimation, energy, isHovering, isAutoMoving, moveDirection, thresholds } = opts;

  const classes: string[] = [];

  if (currentAnimation) {
    classes.push(currentAnimation);
  } else {
    classes.push('breathing');
    if (energy <= thresholds.tiredMood) {
      classes.push('sleepy');
    } else if (isHovering) {
      classes.push('swaying');
    }
  }

  if (isAutoMoving) {
    classes.push(moveDirection === '向右' ? 'crawling-right' : 'crawling-left');
    if (energy > thresholds.canAutoMove) {
      classes.push('breathing');
    }
  }

  return classes.join(' ');
}

/** Resolve the emoji to display based on skin config. */
export function resolvePetEmoji(
  skinConfig: SkinConfig,
  currentSkin: string,
  defaultEmoji: string
): string {
  if (!skinConfig.enabled) return defaultEmoji;
  const skin = skinConfig.skins.find(s => s.id === currentSkin);
  return skin?.value ?? defaultEmoji;
}

/** Resolve what to display: either a custom image or an emoji. */
export function resolvePetDisplay(
  skinConfig: SkinConfig,
  currentSkin: string,
  defaultEmoji: string,
  customImage: string
): PetDisplay {
  if (customImage) {
    return { type: 'image', src: customImage };
  }
  return { type: 'emoji', value: resolvePetEmoji(skinConfig, currentSkin, defaultEmoji) };
}

/** Calculate new X position after auto-move. */
export function calculateMovePosition(
  currentX: number,
  direction: 'right' | 'left',
  screenWidth: number,
  windowWidth: number
): number {
  const moveDistance = Math.floor(Math.random() * 150) + 50;
  const newX = direction === 'right' ? currentX + moveDistance : currentX - moveDistance;
  return Math.max(0, Math.min(newX, screenWidth - windowWidth));
}

/** Format a chime message template, replacing {hour}, {period}, {action}. */
export function formatChimeMessage(template: string, hour: number, action: string): string {
  const displayHour = hour > 12 ? hour - 12 : hour;
  const period = hour >= 12 ? '下午' : '上午';
  return template
    .replace('{hour}', String(displayHour))
    .replace('{period}', period)
    .replace('{action}', action);
}

/**
 * Calculate delay in ms until the next chime.
 * Returns null if chimeHours is empty.
 */
export function getNextChimeDelay(now: Date, chimeHours: number[]): number | null {
  if (chimeHours.length === 0) return null;

  const sorted = [...chimeHours].sort((a, b) => a - b);
  const currentMs = now.getHours() * 3600000 + now.getMinutes() * 60000 + now.getSeconds() * 1000;

  for (const hour of sorted) {
    const targetMs = hour * 3600000;
    if (targetMs > currentMs) {
      return targetMs - currentMs;
    }
  }

  // Wrap to first chime of next day
  const firstChimeMs = sorted[0] * 3600000;
  const msInDay = 24 * 3600000;
  return msInDay - currentMs + firstChimeMs;
}

/** Return hour array for a chime preset name. */
export function getChimePresetHours(preset: string): number[] {
  switch (preset) {
    case 'work':
      return [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    case 'daytime':
      return [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    case 'allday':
      return Array.from({ length: 24 }, (_, i) => i);
    default:
      return [];
  }
}

/** Parse user input for countdown minutes. Returns null for invalid input. */
export function parseCountdownInput(input: string): number | null {
  if (!input) return null;
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0 || n > 120) return null;
  return n;
}

/** Format remaining milliseconds as m:ss display string. */
export function formatCountdownDisplay(remainingMs: number): string {
  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Return the list of available sound presets. */
export function getSoundPresetList(): { id: string; name: string }[] {
  return [
    { id: 'dingdong', name: '叮咚' },
    { id: 'beep', name: '滴滴' },
    { id: 'bell', name: '铃声' },
    { id: 'notification', name: '提示音' },
  ];
}

/** Parse comma-separated hours input string. Returns sorted unique valid hours, or null. */
export function parseCustomHoursInput(input: string): number[] | null {
  if (!input) return null;
  const hours = input
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n) && n >= 0 && n <= 23);
  if (hours.length === 0) return null;
  return [...new Set(hours)].sort((a, b) => a - b);
}
