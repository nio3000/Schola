import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('no-legacy-shell-r6-r4', () => {
  it('does not reference retired shell names in app or workspace runtime sources', () => {
    const files = [
      resolve(ROOT, 'src', 'app', 'App.tsx'),
      resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx'),
    ];
    const forbidden = ['ShellV2', 'WorkspaceShellV2', 'LegacyShell', 'OldWorkspace'];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(content, `${file} should not contain ${token}`).not.toContain(token);
      }
    }
  });
});
