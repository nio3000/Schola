import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('theme-runtime-binding-r6-r9', () => {
  it('ThemeProvider owns the whole renderer tree and syncs root attributes', () => {
    const main = readProjectFile('src', 'app', 'main.tsx');
    const provider = readProjectFile('src', 'features', 'theme', 'ThemeProvider.tsx');

    expect(main).toMatch(/<ThemeProvider>[\s\S]*<AppThemeBootstrap>[\s\S]*<App \/>/);
    expect(provider).toContain("setAttribute('data-theme', theme)");
    expect(provider).toContain("setAttribute('data-app-theme', theme)");
    expect(provider).toContain("localStorage.setItem(SCHOLA_THEME_STORAGE_KEY, theme)");
  });

  it('WorkspaceShell, SettingsModal, Preview, Graph, and Editor are inside the themed App tree', () => {
    const app = readProjectFile('src', 'app', 'App.tsx');
    const workspace = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    const menuBar = readProjectFile('src', 'features', 'workspace', 'CustomMenuBar.tsx');

    expect(app).toContain('<WorkspaceShell');
    expect(workspace).toContain('className="workspace-shell"');
    expect(workspace).toContain('<CustomMenuBar');
    expect(menuBar).toContain('className="schola-menubar"');
    expect(workspace).toContain('data-testid="editor-region"');
    expect(workspace).toContain('data-testid="preview-pane"');
    expect(workspace).toContain('SettingsModal');
    expect(workspace).toContain('GraphMainView');
  });

  it('sets GitHub Light through the same root attributes used by runtime DOM', () => {
    const provider = readProjectFile('src', 'features', 'theme', 'ThemeProvider.tsx');

    expect(provider).toContain("document.documentElement.setAttribute('data-theme', theme)");
    expect(provider).toContain("document.documentElement.setAttribute('data-app-theme', theme)");
    expect(provider).not.toContain("setAttribute('data-theme', DEFAULT_SCHOLA_THEME)");
  });
});
