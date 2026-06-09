import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('theme-token-alias-cascade-r6-r9', () => {
  it('loads CSS in base token, theme token, alias, component order', () => {
    const styles = readProjectFile('src', 'styles.css');
    const order = [
      "tokens/colors.css",
      "themes/github-dark.css",
      "themes/github-light.css",
      "themes/schola-dark.css",
      "tokens/semantic.css",
      "tokens/components.css",
      "features/graph/Graph.css",
    ];

    let lastIndex = -1;
    for (const item of order) {
      const index = styles.indexOf(item);
      expect(index, `${item} should be imported`).toBeGreaterThan(-1);
      expect(index, `${item} import should preserve cascade order`).toBeGreaterThan(lastIndex);
      lastIndex = index;
    }
  });

  it('declares required global aliases from base theme tokens', () => {
    const semantic = readProjectFile('src', 'features', 'theme', 'tokens', 'semantic.css');

    expect(semantic).toContain('--schola-bg: var(--bg-primary)');
    expect(semantic).toContain('--schola-bg-subtle: var(--bg-secondary)');
    expect(semantic).toContain('--schola-sidebar-bg: var(--sidebar-bg, var(--bg-secondary))');
    expect(semantic).toContain('--schola-editor-bg: var(--editor-bg, var(--bg-primary))');
    expect(semantic).toContain('--schola-statusbar-bg: var(--statusbar-bg, var(--bg-tertiary))');
  });

  it('all Phase 5 global themes define required base tokens', () => {
    const required = [
      '--bg-primary',
      '--bg-secondary',
      '--bg-tertiary',
      '--text-primary',
      '--text-secondary',
      '--text-muted',
      '--border',
      '--border-muted',
      '--accent',
      '--input-bg',
      '--input-border',
      '--button-bg',
      '--button-hover-bg',
    ];

    for (const theme of [
      'github-dark',
      'github-dark-dimmed',
      'github-light',
      'schola-dark',
      'schola-light',
      'schola-academic-dark',
      'schola-high-contrast',
    ]) {
      const css = readProjectFile('src', 'features', 'theme', 'themes', `${theme}.css`);
      for (const token of required) {
        expect(css, `${theme} should define ${token}`).toContain(token);
      }
    }
  });
});
