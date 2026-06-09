/**
 * App Menu Service — Phase 5-3-IMP.
 *
 * Main entry point for installing the Schola custom application menu.
 * Replaces the early Phase 1-C hidden menu (Menu.setApplicationMenu(null)).
 *
 * Security: Menu built in main process only. Renderer never receives
 * Menu objects or arbitrary commands. All actions use fixed-function
 * webContents.send() with whitelisted channels.
 */

import type { BrowserWindow } from 'electron';
import { Menu, app } from 'electron';
import { buildMenuTemplate } from './menu-template';
import { createMenuDispatcher } from './menu-action-dispatcher';

export interface InstallMenuOptions {
  readonly mainWindow: BrowserWindow;
  readonly locale?: string;
}

/**
 * Install the Schola custom application menu.
 * Call this once after the main window is created.
 */
export function installScholaMenu(options: InstallMenuOptions): void {
  const { mainWindow, locale } = options;
  const dispatcher = createMenuDispatcher(mainWindow);
  const template = buildMenuTemplate({
    mainWindow,
    isPackaged: app.isPackaged,
    locale,
    dispatcher,
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
