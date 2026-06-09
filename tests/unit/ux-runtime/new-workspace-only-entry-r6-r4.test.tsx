import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('new-workspace-only-entry-r6-r4', () => {
  it('App enters the productized workspace through the single WorkspaceShell component', () => {
    const app = readFileSync(resolve(ROOT, 'src', 'app', 'App.tsx'), 'utf8');

    expect(app).toContain("from '../features/workspace/WorkspaceShell'");
    expect(app).toContain('<WorkspaceShell');
    expect(app).not.toContain('WorkbenchPreviewRoute');
    expect(app).not.toContain('ProviderFreeWorkbenchShell');
  });
});
