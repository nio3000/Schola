/**
 * R6-R14: MWeb Theme Registry structure tests.
 * Verifies that themes are organized in a maintainable registry,
 * not just a flat array in styles.css.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');
const THEMES_DIR = resolve(ROOT, 'src', 'features', 'preview', 'themes');

function readThemeDirFile(name: string): string {
  return readFileSync(resolve(THEMES_DIR, name), 'utf8');
}

const ALL_THEMES = [
  'github', 'medium', 'whitey', 'pixyll', 'newsprint', 'tomorrow',
  'solarized-light', 'greenery', 'm-book', 'typo', 'vue', 'lark',
  'bear-default', 'dracula', 'night', 'spacegray', 'gotham', 'cobalt',
  'solarized-dark', 'charcoal', 'olive-dunk', 'mercury', 'm-web',
];

describe('MWeb Theme Registry (R6-R14)', () => {
  it('registry.ts exports MWEB_THEME_NAMES with 23 themes', () => {
    const registry = readThemeDirFile('registry.ts');
    expect(registry).toContain('export const MWEB_THEME_NAMES');
    for (const theme of ALL_THEMES) {
      expect(registry).toContain(`'${theme}'`);
    }
  });

  it('registry.ts exports MWEB_THEME_LABELS for all 23 themes', () => {
    const registry = readThemeDirFile('registry.ts');
    expect(registry).toContain('export const MWEB_THEME_LABELS');
    expect(registry).toContain("github: 'GitHub'");
    expect(registry).toContain("dracula: 'Dracula'");
  });

  it('registry.ts exports light/dark classification', () => {
    const registry = readThemeDirFile('registry.ts');
    expect(registry).toContain('export const MWEB_THEME_LIGHT');
    expect(registry).toContain('export const MWEB_THEME_DARK');
    // Light themes include github, medium; Dark includes dracula, night
    expect(registry).toContain("'github'");
    expect(registry).toContain("'dracula'");
  });

  it('registry.ts exports isMWebTheme type guard', () => {
    const registry = readThemeDirFile('registry.ts');
    expect(registry).toContain('export function isMWebTheme');
    expect(registry.includes('MWEB_THEME_NAMES as readonly string[]') || registry.includes('.includes(value)')).toBe(true);
  });

  it('index.css imports all 23 theme CSS files', () => {
    const indexCss = readThemeDirFile('index.css');
    for (const theme of ALL_THEMES) {
      expect(indexCss).toContain(`@import './${theme}.css'`);
    }
  });

  it('index.css imports shared selectors', () => {
    const indexCss = readThemeDirFile('index.css');
    expect(indexCss).toContain("@import './_shared-selectors.css'");
  });

  it('index.css contains license attribution', () => {
    const indexCss = readThemeDirFile('index.css');
    expect(indexCss).toContain('https://github.com/imageslr/mweb-themes');
    expect(indexCss).toContain('ISC');
  });

  it('each per-theme CSS file contains both preview and editor sections', () => {
    for (const theme of ALL_THEMES) {
      const css = readThemeDirFile(`${theme}.css`);
      expect(css).toContain('/* ── Preview ── */');
      expect(css).toContain('/* ── Editor ── */');
    }
  });

  it('each per-theme CSS file contains license attribution', () => {
    for (const theme of ['github', 'dracula', 'typo']) {
      const css = readThemeDirFile(`${theme}.css`);
      expect(css).toContain('https://github.com/imageslr/mweb-themes');
      expect(css).toContain('ISC License');
    }
  });

  it('each editor theme uses data-editor-theme attribute selector', () => {
    for (const theme of ['github', 'dracula', 'typo', 'night', 'solarized-light']) {
      const css = readThemeDirFile(`${theme}.css`);
      expect(css).toContain(`.editor-cm[data-editor-theme=${theme}]`);
    }
  });

  it('each preview theme uses data-preview-theme attribute selector', () => {
    for (const theme of ['github', 'dracula', 'typo', 'night', 'solarized-light']) {
      const css = readThemeDirFile(`${theme}.css`);
      expect(css).toContain(`.schola-markdown-preview[data-preview-theme=${theme}]`);
    }
  });

  it('previewThemes.ts re-exports from registry (no inline theme list)', () => {
    const previewThemes = readFileSync(
      resolve(ROOT, 'src', 'features', 'preview', 'previewThemes.ts'), 'utf8'
    );
    expect(previewThemes).toContain("from './themes/registry'");
  });

  it('styles.css imports theme registry via @import', () => {
    const styles = readFileSync(resolve(ROOT, 'src', 'styles.css'), 'utf8');
    expect(styles).toContain("@import './features/preview/themes/index.css'");
  });

  it('license file exists at docs/licenses/mweb-themes-ISC-license.md', () => {
    const license = readFileSync(
      resolve(ROOT, 'docs', 'licenses', 'mweb-themes-ISC-license.md'), 'utf8'
    );
    expect(license).toContain('ISC');
    expect(license).toContain('imageslr');
  });
});
