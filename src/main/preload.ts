import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Window operations
  moveWindow: (x: number, y: number) => ipcRenderer.send('move-window', { x, y }),
  getWindowPosition: () =>
    ipcRenderer.invoke('get-window-position') as Promise<{ x: number; y: number }>,
  getScreenSize: () =>
    ipcRenderer.invoke('get-screen-size') as Promise<{
      width: number;
      height: number;
    }>,
  closeApp: () => ipcRenderer.send('close-app'),

  // State
  loadState: () => ipcRenderer.invoke('load-state'),
  saveState: (state: unknown) => ipcRenderer.send('save-state', state),

  // Context menu
  showContextMenu: () => ipcRenderer.send('show-context-menu'),

  // Events from main process
  onChangeSkin: (cb: (id: string) => void) => {
    ipcRenderer.on('change-skin', (_e, id: string) => cb(id));
  },
  onLoadCustomSkin: (cb: () => void) => {
    ipcRenderer.on('load-custom-skin', () => cb());
  },
  onRefreshState: (cb: () => void) => {
    ipcRenderer.on('refresh-state', () => cb());
  },
  onShowInfo: (cb: () => void) => {
    ipcRenderer.on('show-info', () => cb());
  },
  onSaveOnExit: (cb: () => void) => {
    ipcRenderer.on('save-on-exit', () => cb());
  },

  // Chime controls
  onToggleChime: (cb: () => void) => {
    ipcRenderer.on('toggle-chime', () => cb());
  },
  onSetChimeHours: (cb: (preset: string) => void) => {
    ipcRenderer.on('set-chime-hours', (_e, preset: string) => cb(preset));
  },
  onSetChimeMessage: (cb: (msg: string) => void) => {
    ipcRenderer.on('set-chime-message', (_e, msg: string) => cb(msg));
  },
  onPromptChimeHours: (cb: () => void) => {
    ipcRenderer.on('prompt-chime-hours', () => cb());
  },
  onPromptChimeMessage: (cb: () => void) => {
    ipcRenderer.on('prompt-chime-message', () => cb());
  },

  // Countdown controls
  onStartCountdown: (cb: (minutes: number) => void) => {
    ipcRenderer.on('start-countdown', (_e, minutes: number) => cb(minutes));
  },
  onCancelCountdown: (cb: () => void) => {
    ipcRenderer.on('cancel-countdown', () => cb());
  },
  onPromptCountdown: (cb: () => void) => {
    ipcRenderer.on('prompt-countdown', () => cb());
  },

  // Notify main of countdown/chime/sound state for menu updates
  notifyCountdownState: (active: boolean) => ipcRenderer.send('countdown-state', active),
  notifyChimeState: (enabled: boolean) => ipcRenderer.send('chime-state', enabled),
  notifySoundState: (enabled: boolean) => ipcRenderer.send('sound-state', enabled),

  // Sound controls
  onToggleSound: (cb: () => void) => {
    ipcRenderer.on('toggle-sound', () => cb());
  },
  onSetSoundPreset: (cb: (preset: string) => void) => {
    ipcRenderer.on('set-sound-preset', (_e, preset: string) => cb(preset));
  },
  onLoadCustomSound: (cb: () => void) => {
    ipcRenderer.on('load-custom-sound', () => cb());
  },

  // Signal that save-on-exit is complete
  notifySaveComplete: () => ipcRenderer.send('save-on-exit-done'),

  // Cleanup
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
