/**
 * R6-R6 — Custom titlebar owns the native-controls area.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('custom-titlebar-no-native-controls-gap-r6-r6', () => {
  it('keeps the Electron window frameless and does not enable titleBarOverlay', () => {
    const main = readProjectFile('electron', 'main.ts');

    expect(main).toContain('frame: false');
    expect(main).not.toContain('titleBarOverlay: true');
    expect(main).not.toContain("titleBarStyle: 'hiddenInset'");
  });

  it('fills the top-right native controls area with custom controls', () => {
    const topbar = readProjectFile('src', 'features', 'workspace', 'TopBar.tsx');
    const css = readProjectFile('src', 'styles.css');

    expect(topbar).toMatch(/<div className="topbar-right">[\s\S]*<WindowControls \/>[\s\S]*<\/div>/);
    expect(css).toMatch(/\.topbar-right\s*\{[\s\S]*gap: 8px[\s\S]*-webkit-app-region: no-drag/);
    expect(css).toMatch(/\.window-controls\s*\{[\s\S]*margin-right: -8px/);
    expect(css).toMatch(/\.window-control-button\s*\{[\s\S]*width: 42px[\s\S]*height: 30px/);
  });

  it('preserves the renderer CustomMenuBar instead of falling back to native menu chrome', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    const menuBar = readProjectFile('src', 'features', 'workspace', 'CustomMenuBar.tsx');

    expect(shell).toContain('<CustomMenuBar');
    expect(menuBar).toContain('data-testid="custom-menubar"');
    expect(menuBar).toContain('Native menu is hidden via BrowserWindow frame:false');
  });
});
