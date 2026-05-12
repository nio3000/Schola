import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { registerAppIpc } from './ipc/app.ipc';

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

let mainWindow: BrowserWindow | null = null;

function resolvePreloadPath(): string {
  return path.join(__dirname, 'preload.js');
}

function handleWindowLoadFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Schola failed to load renderer: ${message}`);
  app.quit();
}

function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
  } catch {
    return false;
  }
}

function createMainWindow(): BrowserWindow {
  const createdWindow = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 800,
    minHeight: 520,
    title: 'Schola',
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  createdWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Schola failed to open external URL: ${message}`);
      });
    }

    return { action: 'deny' };
  });

  createdWindow.webContents.on('will-navigate', (event) => {
    const targetUrl = event.url;
    const currentUrl = createdWindow.webContents.getURL();

    if (targetUrl !== currentUrl) {
      event.preventDefault();
    }
  });

  createdWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  const loadPromise = VITE_DEV_SERVER_URL
    ? createdWindow.loadURL(VITE_DEV_SERVER_URL)
    : createdWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));

  loadPromise.catch(handleWindowLoadFailure);

  createdWindow.on('closed', () => {
    mainWindow = null;
  });

  return createdWindow;
}

registerAppIpc();

app.whenReady().then(() => {
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (mainWindow === null) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});