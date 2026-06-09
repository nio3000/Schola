/**
 * Menu No Generic IPC Test — Phase 5-3-IMP.
 *
 * TB-MENU-010, 011, 012: No generic IPC, no generic invoke, no Menu objects to renderer.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('menu-no-generic-ipc (P0)', () => {
  it('TB-MENU-010: action dispatcher should not use generic IPC invoke', () => {
    const dispatcherFile = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (existsSync(dispatcherFile)) {
      const content = readFileSync(dispatcherFile, 'utf8');
      // Should use fixed-function webContents.send, not ipcMain.handle with dynamic channel
      expect(content).not.toContain("ipcMain.handle('menu");
      expect(content).not.toContain('ipcRenderer.invoke');
      // Should use send(), not invoke() for menu actions
      expect(content).toContain("webContents.send('schola:");
    }
  });

  it('TB-MENU-012: menu template should not expose Menu objects', () => {
    const templateFile = resolve(ROOT, 'electron', 'menu', 'menu-template.ts');
    if (existsSync(templateFile)) {
      const content = readFileSync(templateFile, 'utf8');
      // Menu is built in main, never passed to renderer
      expect(content).not.toContain('sendMenu');
      expect(content).not.toContain('exposeMenu');
    }
  });

  it('TB-MENU-011: no eval or new Function in dispatcher', () => {
    const dispatcherFile = resolve(ROOT, 'electron', 'menu', 'menu-action-dispatcher.ts');
    if (existsSync(dispatcherFile)) {
      const content = readFileSync(dispatcherFile, 'utf8');
      // Check only executable code, not comments
      const lines = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
      const codeOnly = lines.join('\n');
      expect(codeOnly).not.toContain('eval(');
      expect(codeOnly).not.toContain('new Function');
    }
  });

  it('command registry should be a static whitelist', () => {
    const registryFile = resolve(ROOT, 'electron', 'menu', 'menu-command-registry.ts');
    if (existsSync(registryFile)) {
      const content = readFileSync(registryFile, 'utf8');
      // All commands are fixed at compile time
      expect(content).toContain('as const');
      // No dynamic generation
      expect(content).not.toContain('generateCommand');
      expect(content).not.toContain('dynamic');
    }
  });
});
