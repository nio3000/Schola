/**
 * R6-R7 — Settings Appearance page exposes the unified GlobalTheme selector.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AppearancePage } from '../../../src/features/settings/components/AppearancePage';
import { ThemeProvider } from '../../../src/features/theme/ThemeProvider';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('settings-appearance-theme-selector-r6-r7', () => {
  it('renders AppearancePage with unified AppThemeSelector inside ThemeProvider', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        ThemeProvider,
        null,
        React.createElement(AppearancePage),
      ),
    );

    expect(html).toContain('data-testid="settings-appearance-page"');
    expect(html).toContain('data-testid="settings-section-theme-selector"');
    expect(html).toContain('data-testid="app-theme-selector"');
    // Unified label
    expect(html).toContain('全局主题');
    // All themes present
    expect(html).toContain('GitHub Dark');
    expect(html).toContain('GitHub Dark Dimmed');
    expect(html).toContain('GitHub Light');
    expect(html).toContain('Schola Dark');
    // No more three-group split
    expect(html).not.toContain('GitHub 主题');
    expect(html).not.toContain('应用外观');
  });

  it('registers Appearance merged into General settings page', () => {
    const general = readProjectFile('src', 'features', 'settings', 'components', 'GeneralPage.tsx');
    expect(general).toContain('AppThemeSelector');
    expect(general).toContain('settings-section-appearance');
    expect(general).toContain('全局主题');
  });

  it('keeps GeneralPage from advertising Appearance as unavailable', () => {
    const general = readProjectFile('src', 'features', 'settings', 'components', 'GeneralPage.tsx');

    expect(general).toContain('AppThemeSelector');
    expect(general).not.toMatch(/外观[\s\S]{0,160}即将推出/);
    expect(general).toContain('编辑器偏好设置');
  });
});
