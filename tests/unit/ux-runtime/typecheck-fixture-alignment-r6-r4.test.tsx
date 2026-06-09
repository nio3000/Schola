import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('typecheck-fixture-alignment-r6-r4', () => {
  it('runtime WorkspaceShell fixtures use current prop names instead of retired shell props', () => {
    const runtimeDir = resolve(ROOT, 'tests', 'unit', 'ux-runtime');
    const files = [
      'activity-mainview-routing.test.tsx',
      'no-vault-shell-visible.test.tsx',
      'no-noop-actions.test.tsx',
      'productized-empty-views-visible.test.tsx',
    ];

    for (const fileName of files) {
      const content = readFileSync(resolve(runtimeDir, fileName), 'utf8');
      expect(content, fileName).toContain('activeVault');
      expect(content, fileName).toContain('selectedFile');
      expect(content, fileName).not.toContain('vaultId={null}');
      expect(content, fileName).not.toContain('fileTree={[]}');
      expect(content, fileName).not.toContain('hasVault={false}');
    }
  });
});
