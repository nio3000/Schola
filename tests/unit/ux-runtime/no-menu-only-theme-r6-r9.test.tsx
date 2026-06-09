import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

function token(theme: 'github-dark' | 'github-light' | 'schola-dark', name: string): string {
  const css = readProjectFile('src', 'features', 'theme', 'themes', `${theme}.css`);
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`Missing --${name} in ${theme}.css`);
  return match[1].trim();
}

describe('no-menu-only-theme-r6-r9', () => {
  it('GitHub Light changes workbench tokens, not only MenuBar tokens', () => {
    for (const name of ['menubar-bg', 'bg-primary', 'sidebar-bg', 'editor-bg', 'statusbar-bg']) {
      expect(token('github-light', name)).not.toBe(token('github-dark', name));
    }
  });

  it('Schola Dark has workbench and MenuBar tokens for synchronized switching', () => {
    for (const name of ['menubar-bg', 'bg-primary', 'bg-secondary', 'text-primary', 'sidebar-bg', 'editor-bg', 'statusbar-bg']) {
      expect(token('schola-dark', name)).toBeTruthy();
    }
  });

  it('does not leave hardcoded dark backgrounds on primary workspace surfaces', () => {
    const styles = readProjectFile('src', 'styles.css');
    const workspaceSurfaceBlocks = styles.match(
      /\.(workspace-shell|workspace-body|schola-sidebar|workspace-editor-area|workspace-editor-canvas|schola-statusbar|schola-bottom-panel)\s*\{[\s\S]*?\n\}/g,
    ) ?? [];

    expect(workspaceSurfaceBlocks.join('\n')).not.toMatch(
      /background:\s*#(?:0d1117|161b22|1e1e1e|181818|202020|252526|2d2d30)\b/i,
    );
  });
});
