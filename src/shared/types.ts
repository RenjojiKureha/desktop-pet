// ---- Skin ----
export interface SkinEntry {
  id: string;
  name: string;
  type: 'emoji' | 'image';
  value: string;
}

export interface SkinConfig {
  enabled: boolean;
  type: string;
  customImage: string;
  skins: SkinEntry[];
  currentSkin: string;
}

// ---- Animation ----
export type AnimationName =
  | 'breathing'
  | 'jumping'
  | 'happy'
  | 'swaying'
  | 'sleepy'
  | 'crawling-right'
  | 'crawling-left'
  | '';

export interface AnimationDurations {
  breatheDuration: number;
  jumpDuration: number;
  happyDuration: number;
  swayDuration: number;
  sleepyDuration: number;
  crawlDuration: number;
}

// ---- Thresholds ----
export interface Thresholds {
  tiredMood: number;
  noAutoMove: number;
  canAutoMove: number;
}

// ---- Timers ----
export interface TimerConfig {
  energyDecreaseInterval: number;
  idleActionInterval: number;
  autoMoveIntervalMin: number;
  autoMoveIntervalMax: number;
  messageShowDuration: number;
}

// ---- Messages ----
export interface Messages {
  click: string[];
  idle: string[];
  lowEnergy: string[];
  moving: string[];
}

export type MessageType = keyof Messages | 'all';

// ---- Moods ----
export interface Moods {
  happy: string[];
  normal: string[];
  tired: string[];
  lowEnergy: string;
}

// ---- Clock ----
export interface ClockConfig {
  enableChime: boolean;
  chimeHours: number[];
  chimeMessage: string;
  chimeActions: string[];
}

// ---- Full App Config ----
export interface AppConfig {
  pet: { name: string; emoji: string; width: number; height: number };
  skin: SkinConfig;
  clock: ClockConfig;
  window: { width: number; height: number; initialX: number; initialY: number };
  animations: AnimationDurations;
  timers: TimerConfig;
  messages: Messages;
  moods: Moods;
  thresholds: Thresholds;
}

// ---- Pet State (persisted) ----
export interface PetState {
  energy: number;
  mood: string;
  currentSkin: string;
  customImage: string;
  timestamp: number;
}

// ---- Serialized state (for disk) ----
export type SerializedState = PetState;

// ---- buildPetClass options ----
export interface BuildPetClassOpts {
  currentAnimation: string;
  energy: number;
  isHovering: boolean;
  isAutoMoving: boolean;
  moveDirection: string;
  thresholds: Thresholds;
}
