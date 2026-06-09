import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');
const source = (...parts: string[]) => resolve(ROOT, 'src', ...parts);

describe('legacy-ui-file-cleanup-r6-r4', () => {
  it('removes retired provider-free workbench preview files from the source tree', () => {
    const retiredFiles = [
      source('features', 'ai-workbench', 'components', 'ProviderFreeWorkbenchShell.tsx'),
      source('features', 'ai-workbench', 'components', 'WorkbenchPreviewRoute.tsx'),
      source('features', 'ai-workbench', 'components', 'WorkbenchPreviewLauncherEntry.tsx'),
    ];

    for (const file of retiredFiles) {
      expect(existsSync(file), file).toBe(false);
    }
  });

  it('keeps the real AI research main view as the only workspace AI surface', () => {
    const shell = readFileSync(source('features', 'workspace', 'WorkspaceShell.tsx'), 'utf8');

    expect(shell).toContain('AIResearchMainView');
    expect(shell).not.toContain('ProviderFreeWorkbenchShell');
    expect(shell).not.toContain('WorkbenchPreviewRoute');
  });
});
