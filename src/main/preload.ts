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

  // Signal that save-on-exit is complete
  notifySaveComplete: () => ipcRenderer.send('save-on-exit-done'),

  // Cleanup
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});
