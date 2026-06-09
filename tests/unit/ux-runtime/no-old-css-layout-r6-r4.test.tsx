import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('no-old-css-layout-r6-r4', () => {
  it('does not keep retired workspace layout selectors in global CSS', () => {
    const css = readFileSync(resolve(ROOT, 'src', 'styles.css'), 'utf8');

    expect(css).not.toMatch(/\.workspace-main\b/);
    expect(css).not.toMatch(/\.workspace-content\s*[{,]/);
    expect(css).not.toMatch(/\.workspace-editor\s*[{,]/);
    expect(css).toMatch(/\.workspace-editor-area\s*\{/);
    expect(css).toMatch(/\.workspace-editor-canvas\s*\{/);
  });
});
