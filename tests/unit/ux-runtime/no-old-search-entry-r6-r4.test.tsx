import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('no-old-search-entry-r6-r4', () => {
  it('removes ActivityBar search while keeping the TopBar command search', () => {
    const activityBar = readFileSync(
      resolve(ROOT, 'src', 'features', 'workspace', 'ActivityBar.tsx'),
      'utf8',
    );
    const topBar = readFileSync(resolve(ROOT, 'src', 'features', 'workspace', 'TopBar.tsx'), 'utf8');

    expect(activityBar).not.toContain("id: 'search'");
    expect(activityBar).not.toContain('Search');
    expect(topBar).toContain('data-testid="topbar-command-input"');
    expect(topBar).toContain('type="search"');
    expect(topBar).toContain('onOpenSearch');
  });
});
