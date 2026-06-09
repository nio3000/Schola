/**
 * R6-R6 — Frameless window controls are visible in the custom titlebar.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { WindowControls } from '../../../src/features/workspace/WindowControls';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('window-controls-r6-r6', () => {
  it('renders minimize, maximize/restore, and close buttons', () => {
    const html = renderToStaticMarkup(React.createElement(WindowControls));

    expect(html).toContain('data-testid="window-controls"');
    expect(html).toContain('data-testid="window-control-minimize"');
    expect(html).toContain('data-testid="window-control-maximize"');
    expect(html).toContain('data-testid="window-control-close"');
    expect(html).toContain('aria-label="最小化窗口"');
    expect(html).toContain('aria-label="最大化窗口"');
    expect(html).toContain('aria-label="关闭窗口"');
  });

  it('is mounted from TopBar next to the existing file status area', () => {
    const topbar = readProjectFile('src', 'features', 'workspace', 'TopBar.tsx');

    expect(topbar).toContain("import { WindowControls } from './WindowControls'");
    expect(topbar).toContain('<WindowControls />');
    expect(topbar).toContain('topbar-right');
  });

  it('keeps control buttons out of the draggable titlebar region', () => {
    const css = readProjectFile('src', 'styles.css');

    expect(css).toMatch(/\.schola-topbar\s*\{[\s\S]*-webkit-app-region: drag/);
    expect(css).toMatch(/\.window-controls\s*\{[\s\S]*-webkit-app-region: no-drag/);
    expect(css).toMatch(/\.window-control-button\s*\{[\s\S]*-webkit-app-region: no-drag/);
  });
});
