/**
 * R6-R6 — Window controls use fixed-function IPC through preload.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('window-controls-ipc-contract-r6-r6', () => {
  it('declares fixed window control channels in the shared app contract', () => {
    const contract = readProjectFile('src', 'lib', 'contracts', 'app.types.ts');

    expect(contract).toContain("WINDOW_MINIMIZE_CHANNEL = 'window:minimize'");
    expect(contract).toContain("WINDOW_TOGGLE_MAXIMIZE_CHANNEL = 'window:toggle-maximize'");
    expect(contract).toContain("WINDOW_CLOSE_CHANNEL = 'window:close'");
    expect(contract).toContain("WINDOW_IS_MAXIMIZED_CHANNEL = 'window:is-maximized'");
    expect(contract).toContain('interface ScholaWindowControlsApi');
    expect(contract).toContain('readonly windowControls: ScholaWindowControlsApi;');
  });

  it('exposes only narrow windowControls methods through preload', () => {
    const preload = readProjectFile('electron', 'preload.ts');

    expect(preload).toContain('windowControls: Object.freeze({');
    expect(preload).toContain('minimize: () => ipcRenderer.invoke(WINDOW_MINIMIZE_CHANNEL)');
    expect(preload).toContain('toggleMaximize: () => ipcRenderer.invoke(WINDOW_TOGGLE_MAXIMIZE_CHANNEL)');
    expect(preload).toContain('close: () => ipcRenderer.invoke(WINDOW_CLOSE_CHANNEL)');
    expect(preload).toContain('isMaximized: () => ipcRenderer.invoke(WINDOW_IS_MAXIMIZED_CHANNEL)');
    expect(preload).not.toContain('readonly invoke');
    expect(preload).not.toContain('ipcRenderer: ipcRenderer');
  });

  it('registers handlers against the sender BrowserWindow', () => {
    const appIpc = readProjectFile('electron', 'ipc', 'app.ipc.ts');

    expect(appIpc).toContain('BrowserWindow.fromWebContents(event.sender)');
    expect(appIpc).toContain('ipcMain.handle(WINDOW_MINIMIZE_CHANNEL');
    expect(appIpc).toContain('ipcMain.handle(WINDOW_TOGGLE_MAXIMIZE_CHANNEL');
    expect(appIpc).toContain('ipcMain.handle(WINDOW_CLOSE_CHANNEL');
    expect(appIpc).toContain('ipcMain.handle(WINDOW_IS_MAXIMIZED_CHANNEL');
    expect(appIpc).toContain('window.unmaximize()');
    expect(appIpc).toContain('window.maximize()');
  });

  it('keeps renderer access behind platform wrappers', () => {
    const platform = readProjectFile('src', 'lib', 'platform', 'schola-api.ts');

    expect(platform).toContain('minimizeWindow');
    expect(platform).toContain('toggleMaximizeWindow');
    expect(platform).toContain('closeWindow');
    expect(platform).toContain('isWindowMaximized');
    expect(platform).toContain('window.schola.windowControls');
  });
});
