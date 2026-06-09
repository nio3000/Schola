import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('no-old-settings-routes-r6-r4', () => {
  it('WorkspaceShell opens settings through SettingsModal and SettingsCenter only', () => {
    const shell = readFileSync(
      resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx'),
      'utf8',
    );

    expect(shell).toContain('SettingsModal');
    expect(shell).toContain('SettingsCenter');
    expect(shell).toContain('setSettingsModalOpen(true)');
    expect(shell).not.toContain('SettingsPlaceholder');
    expect(shell).not.toContain('settings-bottom');
  });
});
