export interface ElectronAPI {
  moveWindow: (x: number, y: number) => void;
  getWindowPosition: () => Promise<{ x: number; y: number }>;
  getScreenSize: () => Promise<{ width: number; height: number }>;
  closeApp: () => void;

  loadState: () => Promise<unknown>;
  saveState: (state: unknown) => void;

  showContextMenu: () => void;

  onChangeSkin: (cb: (id: string) => void) => void;
  onLoadCustomSkin: (cb: () => void) => void;
  onRefreshState: (cb: () => void) => void;
  onShowInfo: (cb: () => void) => void;
  onSaveOnExit: (cb: () => void) => void;

  // Chime controls
  onToggleChime: (cb: () => void) => void;
  onSetChimeHours: (cb: (preset: string) => void) => void;
  onSetChimeMessage: (cb: (msg: string) => void) => void;
  onPromptChimeHours: (cb: () => void) => void;
  onPromptChimeMessage: (cb: () => void) => void;

  // Countdown controls
  onStartCountdown: (cb: (minutes: number) => void) => void;
  onCancelCountdown: (cb: () => void) => void;
  onPromptCountdown: (cb: () => void) => void;

  // Sound controls
  onToggleSound: (cb: () => void) => void;
  onSetSoundPreset: (cb: (preset: string) => void) => void;
  onLoadCustomSound: (cb: () => void) => void;

  // Notify main of state for menu updates
  notifyCountdownState: (active: boolean) => void;
  notifyChimeState: (enabled: boolean) => void;
  notifySoundState: (enabled: boolean) => void;

  notifySaveComplete: () => void;

  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
