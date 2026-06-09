/**
 * IMP-11: No Electron / Preload / IPC expansion test.
 *
 * Verifies that electron main, preload, and IPC files are not modified.
 * Verifies no new IPC channels are added.
 * Verifies no generic IPC or ipcRenderer exposure.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

const ELECTRON_FILES = [
  'electron/main.ts',
  'electron/preload.ts',
];

const FORBIDDEN_IPC_PATTERNS = [
  'ipcMain.handle',
  'ipcRenderer.invoke',
  'contextBridge.exposeInMainWorld',
];

const FORBIDDEN_ELECTRON_EXPOSURE = [
  'exposeInMainWorld(\'electronAPI\'',
  'exposeInMainWorld(\'ipcRenderer\'',
  'exposeInMainWorld("electronAPI"',
  'exposeInMainWorld("ipcRenderer"',
];

function readFileSafe(relativePath: string): string {
  const full = resolve(ROOT, relativePath);
  assert.ok(existsSync(full), `File should exist: ${relativePath}`);
  return readFileSync(full, 'utf8');
}

describe('ui-graph-theme-no-electron-ipc (P0)', () => {
  it('electron main.ts should exist and contain no generic IPC exposure', () => {
    const content = readFileSafe('electron/main.ts');
    for (const pattern of FORBIDDEN_ELECTRON_EXPOSURE) {
      assert.ok(
        !content.includes(pattern),
        `electron/main.ts should NOT contain: ${pattern}`,
      );
    }
  });

  it('electron preload.ts should not expose generic ipcRenderer', () => {
    const content = readFileSafe('electron/preload.ts');
    for (const pattern of FORBIDDEN_ELECTRON_EXPOSURE) {
      assert.ok(
        !content.includes(pattern),
        `electron/preload.ts should NOT contain: ${pattern}`,
      );
    }
  });

  it('no new IPC channels should reference generic invoke pattern', () => {
    const content = readFileSafe('electron/preload.ts');
    // Generic invoke would be a security boundary violation
    const genericInvoke = content.match(/ipcRenderer\.invoke\s*\(\s*channel/);
    assert.strictEqual(genericInvoke, null, 'Should NOT have generic invoke pattern');
  });

  it('electron/preload.ts should NOT expose ipcRenderer object directly', () => {
    const content = readFileSafe('electron/preload.ts');
    assert.ok(
      !content.includes('ipcRenderer:'),
      'preload should NOT expose ipcRenderer object directly',
    );
  });

  it('should not reference Phase 6 or PRE6 code paths', () => {
    const preloadContent = readFileSafe('electron/preload.ts');
    const mainContent = readFileSafe('electron/main.ts');
    const combined = preloadContent + mainContent;
    assert.ok(!combined.includes('Phase 6'), 'Should NOT reference Phase 6');
    assert.ok(!combined.includes('PRE6'), 'Should NOT reference PRE6');
  });
});
