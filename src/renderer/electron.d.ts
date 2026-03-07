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

  notifySaveComplete: () => void;

  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
