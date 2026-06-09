/**
 * R6-R7 — Unified GlobalTheme selector replaces the old three-group selector.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AppThemeSelector } from '../../../src/features/theme/AppThemeSelector';
import { ThemeProvider } from '../../../src/features/theme/ThemeProvider';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('github-theme-switch-settings-r6-r7', () => {
  it('shows a single unified GlobalTheme selector with all themes', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(AppThemeSelector),
      ),
    );

    // Single label — no more three optgroups
    expect(html).toContain('全局主题');
    // All themes present as options
    expect(html).toContain('GitHub Dark');
    expect(html).toContain('GitHub Dark Dimmed');
    expect(html).toContain('GitHub Light');
    expect(html).toContain('Schola Dark');
    expect(html).toContain('Schola Light');
    // Unified selector, no "app appearance" group
    expect(html).not.toContain('GitHub 主题');
    expect(html).not.toContain('Schola 主题令牌');
    expect(html).not.toContain('应用外观');
  });

  it('keeps all themes in the global catalog', () => {
    const appThemes = readProjectFile('src', 'features', 'theme', 'appThemes.ts');
    for (const theme of ['github-dark', 'github-dark-dimmed', 'github-light', 'schola-dark']) {
      expect(appThemes).toContain(`'${theme}'`);
      }
  });

  it('ThemeProvider applies both data-theme and data-app-theme synchronously', () => {
    const provider = readProjectFile('src', 'features', 'theme', 'ThemeProvider.tsx');

    expect(provider).toContain("setAttribute('data-theme', theme)");
    expect(provider).toContain("setAttribute('data-app-theme', theme)");
  });

  it('AppThemeSelector uses single ThemeContext setGlobalTheme', () => {
    const selector = readProjectFile('src', 'features', 'theme', 'AppThemeSelector.tsx');

    expect(selector).toContain('setGlobalTheme');
    expect(selector).toContain('useTheme()');
    expect(selector).toContain('全局主题');
  });
});
