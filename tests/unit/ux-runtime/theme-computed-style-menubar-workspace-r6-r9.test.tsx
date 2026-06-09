import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

function token(theme: 'github-dark' | 'github-light', name: string): string {
  const css = readProjectFile('src', 'features', 'theme', 'themes', `${theme}.css`);
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`Missing --${name} in ${theme}.css`);
  return match[1].trim();
}

describe('theme-computed-style-menubar-workspace-r6-r9', () => {
  it('GitHub Light changes MenuBar and Workspace runtime background tokens from GitHub Dark', () => {
    expect(token('github-light', 'menubar-bg')).not.toBe(token('github-dark', 'menubar-bg'));
    expect(token('github-light', 'bg-primary')).not.toBe(token('github-dark', 'bg-primary'));
    expect(token('github-light', 'bg-primary')).toBe('#ffffff');
  });

  it('GitHub Light changes Sidebar, Editor, and StatusBar runtime background tokens', () => {
    expect(token('github-light', 'sidebar-bg')).not.toBe(token('github-dark', 'sidebar-bg'));
    expect(token('github-light', 'editor-bg')).not.toBe(token('github-dark', 'editor-bg'));
    expect(token('github-light', 'statusbar-bg')).not.toBe(token('github-dark', 'statusbar-bg'));
  });
});
