/**
 * R6-R2 Workbench UI — BottomPanel top resizer.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { BottomPanel } from '../../../src/features/workspace/BottomPanel';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('bottom-panel-resizer-r6-r2', () => {
  it('renders a top resizer only when BottomPanel is open', () => {
    const openHtml = renderToStaticMarkup(
      React.createElement(BottomPanel, {
        isOpen: true,
        height: 260,
        onToggle: () => {},
        onResizeStart: () => {},
        resizerRef: () => {},
      }),
    );
    const closedHtml = renderToStaticMarkup(
      React.createElement(BottomPanel, { isOpen: false, onToggle: () => {} }),
    );
    expect(openHtml).toContain('bottom-panel-resizer');
    expect(openHtml).toContain('aria-label="调整底部面板高度"');
    expect(openHtml).toContain('aria-orientation="horizontal"');
    expect(openHtml).toContain('style="height:260px"');
    expect(closedHtml).not.toContain('bottom-panel-resizer');
  });

  it('keeps bottom panel height state in WorkspaceShell with viewport bounds', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    expect(shell).toContain('BOTTOM_PANEL_DEFAULT_HEIGHT = 220');
    expect(shell).toContain('BOTTOM_PANEL_MIN_HEIGHT = 120');
    expect(shell).toContain('BOTTOM_PANEL_MAX_VIEWPORT_RATIO = 0.5');
    expect(shell).toContain('const [bottomPanelHeight, setBottomPanelHeight]');
    expect(shell).toContain('setBottomPanelHeight((height) => clamp(height - deltaY');
    expect(shell).toContain('height={bottomPanelHeight}');
  });

  it('styles the bottom panel top resizer with row-resize and visible boundaries', () => {
    const css = readProjectFile('src', 'styles.css');
    expect(css).toMatch(/\.bottom-panel-resizer\s*\{[\s\S]*cursor: row-resize/);
    expect(css).toContain('.bottom-panel-resizer.is-dragging');
    expect(css).toMatch(/\.schola-bottom-panel\s*\{[\s\S]*border-top: 1px solid var\(--border\)/);
    expect(css).toMatch(/\.schola-bottom-panel-open\s*\{[\s\S]*max-height: 50vh/);
  });

  it('does not move Settings into BottomPanel', () => {
    const bottomPanel = readProjectFile('src', 'features', 'workspace', 'BottomPanel.tsx');
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    expect(bottomPanel).not.toContain('SettingsModal');
    expect(bottomPanel).not.toContain('SettingsCenter');
    expect(shell).toContain('<SettingsModal');
    expect(shell).toContain('<SettingsCenter />');
  });
});
