/**
 * UX Rebase — No New IPC / No Dependency Boundary Test (P0: UX-TB-P0-049 ~ 057)
 * Phase 5-UX-REBASE-IMP.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readIfExists(relativePath: string): string | null {
  const full = resolve(ROOT, relativePath);
  if (existsSync(full)) return readFileSync(full, 'utf8');
  return null;
}

describe('ux-rebase no-new-ipc-no-dependency (P0)', () => {
  it('UX-TB-P0-049: no new IPC channels in new UX code', () => {
    const files = [
      'src/features/workspace/components/EditorToolbar.tsx',
      'src/features/settings/components/SettingsModal.tsx',
    ];
    for (const file of files) {
      const content = readIfExists(file);
      if (content) {
        const lines = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
        const code = lines.join('\n');
        expect(code).not.toContain('ipcRenderer');
        expect(code).not.toContain('ipcMain');
      }
    }
  });

  it('UX-TB-P0-050: no ipcRenderer exposure in new UX code', () => {
    const files = [
      'src/features/workspace/components/EditorToolbar.tsx',
      'src/features/settings/components/SettingsModal.tsx',
    ];
    for (const file of files) {
      const content = readIfExists(file);
      if (content) {
        const lines = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
        const code = lines.join('\n');
        expect(code).not.toContain('ipcRenderer');
        expect(code).not.toContain('contextBridge');
      }
    }
  });

  it('UX-TB-P0-053: no shell.openExternal in new UX code', () => {
    const files = [
      'src/features/workspace/components/EditorToolbar.tsx',
      'src/features/settings/components/SettingsModal.tsx',
    ];
    for (const file of files) {
      const content = readIfExists(file);
      if (content) {
        const lines = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
        const code = lines.join('\n');
        expect(code).not.toContain('shell.openExternal');
      }
    }
  });

  it('UX-TB-P0-054: no AI provider invocation in new UX code', () => {
    const files = [
      'src/features/workspace/components/EditorToolbar.tsx',
      'src/features/settings/components/SettingsModal.tsx',
    ];
    for (const file of files) {
      const content = readIfExists(file);
      if (content) {
        const lines = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
        const code = lines.join('\n');
        // 'provider' as navigation label is fine; check for actual invocation patterns
        expect(code).not.toContain('runTask');
        expect(code).not.toContain('sendContext');
        expect(code).not.toContain('invokeProvider');
      }
    }
  });

  it('UX-TB-P0-056: no Vault write in new UX code', () => {
    const files = [
      'src/features/workspace/components/EditorToolbar.tsx',
      'src/features/settings/components/SettingsModal.tsx',
    ];
    for (const file of files) {
      const content = readIfExists(file);
      if (content) {
        const lines = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
        const code = lines.join('\n');
        expect(code).not.toContain('writeFile');
        expect(code).not.toContain('saveToVault');
        expect(code).not.toContain('exportArtifact');
      }
    }
  });
});
