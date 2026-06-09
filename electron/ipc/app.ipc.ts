import type { AppInfo, HelpOpenResult } from '../../src/lib/contracts/app.types';
import {
  APP_GET_INFO_CHANNEL,
  APP_OPEN_HELP_CHANNEL,
  APP_RENDERER_READY_CHANNEL,
  APP_PERF_LOG_CHANNEL,
  WINDOW_CLOSE_CHANNEL,
  WINDOW_IS_MAXIMIZED_CHANNEL,
  WINDOW_MINIMIZE_CHANNEL,
  WINDOW_TOGGLE_MAXIMIZE_CHANNEL,
} from '../../src/lib/contracts/app.types';
import { app, BrowserWindow, ipcMain } from 'electron';
import { PROCESS_START_AT, perfLog } from '../lib/perf';

function getSenderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

export function registerAppIpc(): void {
  ipcMain.handle(APP_GET_INFO_CHANNEL, (): AppInfo => ({
    name: 'Schola',
    version: '1.0',
    platform: process.platform,
    phase: 'Bate\u7248',
  }));

  ipcMain.handle(APP_OPEN_HELP_CHANNEL, (): HelpOpenResult => ({
    ok: true,
    status: 'placeholder',
    title: 'Schola 帮助中心',
    message:
      '帮助内容正在建设中。后续将补充：打开知识库、创建知识库、Markdown 编辑、图谱、导入导出等说明。',
  }));

  ipcMain.on(APP_RENDERER_READY_CHANNEL, () => {
    perfLog(`[perf:startup] rendererReady=${Date.now() - PROCESS_START_AT}ms`);
  });

  ipcMain.on(APP_PERF_LOG_CHANNEL, (_event, message: unknown) => {
    if (typeof message === 'string') {
      perfLog(message);
    }
  });

  ipcMain.handle(WINDOW_MINIMIZE_CHANNEL, (event): void => {
    getSenderWindow(event)?.minimize();
  });

  ipcMain.handle(WINDOW_TOGGLE_MAXIMIZE_CHANNEL, (event): boolean => {
    const window = getSenderWindow(event);
    if (!window) return false;
    if (window.isMaximized()) {
      window.unmaximize();
      return false;
    }
    window.maximize();
    return true;
  });

  ipcMain.handle(WINDOW_CLOSE_CHANNEL, (event): void => {
    getSenderWindow(event)?.close();
  });

  ipcMain.handle(WINDOW_IS_MAXIMIZED_CHANNEL, (event): boolean => {
    return getSenderWindow(event)?.isMaximized() ?? false;
  });
}
