import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';

const THEME_DIR = resolve(__dirname, '..', '..', '..', 'src', 'features', 'theme');
const TOKENS_DIR = resolve(THEME_DIR, 'tokens');
const THEMES_DIR = resolve(THEME_DIR, 'themes');

describe('theme-token-system (P1)', () => {
  it('colors.css should exist with CSS custom properties', () => {
    const path = resolve(TOKENS_DIR, 'colors.css');
    assert.ok(existsSync(path), 'tokens/colors.css should exist');
    const content = readFileSync(path, 'utf8');
    assert.ok(content.includes('--'), 'colors.css should define CSS custom properties');
  });

  it('semantic.css should exist', () => {
    const path = resolve(TOKENS_DIR, 'semantic.css');
    assert.ok(existsSync(path), 'tokens/semantic.css should exist');
  });

  it('components.css should exist', () => {
    const path = resolve(TOKENS_DIR, 'components.css');
    assert.ok(existsSync(path), 'tokens/components.css should exist');
  });

  it('four theme CSS files should exist', () => {
    const themes = ['schola-dark.css', 'schola-light.css', 'schola-academic-dark.css', 'schola-high-contrast.css'];
    for (const t of themes) {
      assert.ok(existsSync(resolve(THEMES_DIR, t)), `themes/${t} should exist`);
    }
  });

  it('ThemeProvider.tsx should exist and set data-theme', () => {
    const path = resolve(THEME_DIR, 'ThemeProvider.tsx');
    assert.ok(existsSync(path), 'ThemeProvider.tsx should exist');
    const content = readFileSync(path, 'utf8');
    assert.ok(content.includes('data-theme'), 'ThemeProvider should use data-theme attribute');
    assert.ok(content.includes('schola.theme'), 'ThemeProvider should use schola.theme localStorage key');
  });

  it('ThemeProvider should not save secrets', () => {
    const path = resolve(THEME_DIR, 'ThemeProvider.tsx');
    const content = readFileSync(path, 'utf8');
    assert.ok(!content.includes('apiKey'), 'ThemeProvider should not save API keys');
    assert.ok(!content.includes('secret'), 'ThemeProvider should not save secrets');
    assert.ok(!content.includes('password'), 'ThemeProvider should not save passwords');
  });

  it('ThemeProvider should not load remote resources', () => {
    const path = resolve(THEME_DIR, 'ThemeProvider.tsx');
    const content = readFileSync(path, 'utf8');
    assert.ok(!content.includes('fetch('), 'ThemeProvider should not fetch remote resources');
    assert.ok(!content.includes('http://'), 'ThemeProvider should not reference HTTP');
    assert.ok(!content.includes('https://'), 'ThemeProvider should not reference HTTPS');
  });
});
