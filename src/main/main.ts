import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  Menu,
  Tray,
  nativeImage,
  IpcMainEvent,
  IpcMainInvokeEvent,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface WindowPosition {
  x: number;
  y: number;
}

interface ScreenSize {
  width: number;
  height: number;
}

interface PetState {
  energy?: number;
  mood?: string;
  currentSkin?: string;
  customImage?: string;
  timestamp?: number;
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const STATE_FILE = path.join(app.getPath('userData'), 'pet-state.json');

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 300,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    skipTaskbar: true,
    hasShadow: false,
    x: 100,
    y: 100,
  });

  mainWindow.loadFile('dist/renderer/index.html');
  createTray();
}

function createTray(): void {
  // Use a 16x16 empty image if no icon file exists
  const iconPath = path.join(__dirname, '..', '..', 'public', 'icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示宠物',
      click: () => mainWindow?.show(),
    },
    {
      label: '隐藏宠物',
      click: () => mainWindow?.hide(),
    },
    { type: 'separator' },
    {
      label: '更换皮肤',
      submenu: [
        { label: '大鳐鱼 🐟', click: () => mainWindow?.webContents.send('change-skin', 'default') },
        { label: '尼莫 🐠', click: () => mainWindow?.webContents.send('change-skin', 'nemo') },
        { label: '鲨鱼 🦈', click: () => mainWindow?.webContents.send('change-skin', 'shark') },
        { label: '鲸鱼 🐋', click: () => mainWindow?.webContents.send('change-skin', 'whale') },
        { label: '章鱼 🐙', click: () => mainWindow?.webContents.send('change-skin', 'octopus') },
        { label: '螃蟹 🦀', click: () => mainWindow?.webContents.send('change-skin', 'crab') },
        { label: '龙虾 🦞', click: () => mainWindow?.webContents.send('change-skin', 'lobster') },
        { type: 'separator' },
        {
          label: '加载自定义皮肤...',
          click: () => mainWindow?.webContents.send('load-custom-skin'),
        },
      ],
    },
    { type: 'separator' },
    { label: '显示信息', click: () => mainWindow?.webContents.send('show-info') },
    {
      label: '重置状态',
      click: () => {
        saveState({
          energy: 100,
          mood: '开心',
          currentSkin: 'default',
          customImage: '',
          timestamp: Date.now(),
        });
        mainWindow?.webContents.send('refresh-state');
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: async () => {
        if (mainWindow) {
          try {
            // Wait for renderer to save state before quitting (fixes bug #8)
            mainWindow.webContents.send('save-on-exit');
            await new Promise<void>(resolve => {
              const handler = () => {
                resolve();
              };
              ipcMain.once('save-on-exit-done', handler);
              // Timeout fallback: quit after 2s even if renderer doesn't respond
              setTimeout(() => {
                ipcMain.removeListener('save-on-exit-done', handler);
                resolve();
              }, 2000);
            });
          } catch {
            // Ignore errors during shutdown
          }
        }
        app.quit();
      },
    },
  ]);

  tray.setToolTip('桌面宠物 - 大鳐鱼');
  tray.setContextMenu(contextMenu);
}

function loadState(): PetState | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data) as PetState;
    }
  } catch (err) {
    console.error('Failed to load state:', err);
  }
  return null;
}

function saveState(state: PetState): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8');
  } catch (err) {
    console.error('Failed to save state:', err);
  }
}

app.whenReady().then(() => {
  createWindow();

  // ---- IPC handlers (all async invoke pattern) ----

  ipcMain.on('move-window', (_event: IpcMainEvent, { x, y }: WindowPosition) => {
    if (mainWindow) {
      mainWindow.setPosition(x, y);
    }
  });

  ipcMain.handle(
    'get-window-position',
    async (_event: IpcMainInvokeEvent): Promise<WindowPosition> => {
      if (mainWindow) {
        const [x, y] = mainWindow.getPosition();
        return { x, y };
      }
      return { x: 0, y: 0 };
    }
  );

  ipcMain.handle('get-screen-size', async (_event: IpcMainInvokeEvent): Promise<ScreenSize> => {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    return { width, height };
  });

  ipcMain.handle('load-state', async (_event: IpcMainInvokeEvent): Promise<PetState | null> => {
    return loadState();
  });

  ipcMain.on('save-state', (_event: IpcMainEvent, state: PetState) => {
    saveState(state);
  });

  ipcMain.on('show-context-menu', (event: IpcMainEvent) => {
    const template: Array<Electron.MenuItemConstructorOptions> = [
      {
        label: '更换宠物',
        submenu: [
          { label: '大鳐鱼 🐟', click: () => event.sender.send('change-skin', 'default') },
          { label: '尼莫 🐠', click: () => event.sender.send('change-skin', 'nemo') },
          { label: '鲨鱼 🦈', click: () => event.sender.send('change-skin', 'shark') },
          { label: '鲸鱼 🐋', click: () => event.sender.send('change-skin', 'whale') },
          { label: '章鱼 🐙', click: () => event.sender.send('change-skin', 'octopus') },
          { label: '螃蟹 🦀', click: () => event.sender.send('change-skin', 'crab') },
          { label: '龙虾 🦞', click: () => event.sender.send('change-skin', 'lobster') },
          { type: 'separator' as const },
          { label: '加载本地图片...', click: () => event.sender.send('load-custom-skin') },
        ],
      },
      {
        label: '刷新状态',
        click: () => event.sender.send('refresh-state'),
      },
      {
        label: '显示信息',
        click: () => event.sender.send('show-info'),
      },
      { type: 'separator' as const },
      {
        label: '退出',
        click: () => {
          event.sender.send('save-on-exit');
          // Give renderer time to save, then quit
          ipcMain.once('save-on-exit-done', () => app.quit());
          setTimeout(() => app.quit(), 2000);
        },
      },
    ];

    const contextMenu = Menu.buildFromTemplate(template);
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    if (browserWindow) {
      contextMenu.popup({ window: browserWindow });
    }
  });

  ipcMain.on('close-app', () => {
    app.quit();
  });

  ipcMain.on('save-on-exit-done', () => {
    // Handled by the quit flow
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
