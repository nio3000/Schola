/**
 * UX Rebase — No VS Code Source Boundary Test (P0: UX-TB-P0-005 ~ 006)
 * Phase 5-UX-REBASE-IMP.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('ux-rebase no-vscode-source-boundary (P0)', () => {
  it('UX-TB-P0-005: no VS Code source in new UX code', () => {
    const patterns = ['microsoft/vscode', 'Code-OSS', 'codicon', 'vs/base', 'vs/workbench'];
    const files = [
      'src/features/workspace/components/EditorToolbar.tsx',
      'src/features/settings/components/SettingsModal.tsx',
    ];
    for (const file of files) {
      const full = resolve(ROOT, file);
      if (!existsSync(full)) continue;
      const content = readFileSync(full, 'utf8');
      const lines = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
      const code = lines.join('\n');
      for (const pattern of patterns) {
        expect(code).not.toContain(pattern);
      }
    }
  });

  it('UX-TB-P0-006: no VS Code brand references', () => {
    const files = [
      'src/features/workspace/components/EditorToolbar.tsx',
      'src/features/settings/components/SettingsModal.tsx',
    ];
    for (const file of files) {
      const full = resolve(ROOT, file);
      if (!existsSync(full)) continue;
      const content = readFileSync(full, 'utf8');
      expect(content).not.toContain('Visual Studio Code');
    }
  });

  it('no Monaco references in new UX code', () => {
    const files = [
      'src/features/workspace/components/EditorToolbar.tsx',
      'src/features/settings/components/SettingsModal.tsx',
    ];
    for (const file of files) {
      const full = resolve(ROOT, file);
      if (!existsSync(full)) continue;
      const content = readFileSync(full, 'utf8');
      const lines = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'));
      const code = lines.join('\n');
      expect(code).not.toContain('monaco');
    }
  });
});
