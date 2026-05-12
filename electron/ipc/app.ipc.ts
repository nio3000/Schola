import type { AppInfo } from '../../src/lib/contracts/app.types';
import { APP_GET_INFO_CHANNEL } from '../../src/lib/contracts/app.types';
import { app, ipcMain } from 'electron';

export function registerAppIpc(): void {
  ipcMain.handle(APP_GET_INFO_CHANNEL, (): AppInfo => ({
    name: 'Schola',
    version: app.getVersion(),
    platform: process.platform,
    phase: 'phase-0',
  }));
}