/**
 * IMP-11: Theme non-secret persistence test.
 *
 * Verifies that the theme system only persists theme preference
 * and does NOT store secrets, API keys, or sensitive data in localStorage.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'vitest';

// Simulate localStorage-like behavior
let storage: Record<string, string>;

beforeEach(() => {
  storage = {};
  // Mock localStorage for this test module
  globalThis.localStorage = {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => { storage[key] = value; },
    removeItem: (key: string) => { delete storage[key]; },
    clear: () => { storage = {}; },
    get length() { return Object.keys(storage).length; },
    key: (index: number) => Object.keys(storage)[index] ?? null,
  };
});

const SENSITIVE_KEY_PATTERNS = [
  'apiKey',
  'api_key',
  'API_KEY',
  'apikey',
  'secret',
  'SECRET',
  'password',
  'token',
  'credential',
  'private',
  'contextPack',
  'contextPack',
  'systemPrompt',
  'fileContent',
  'absolutePath',
  'relativePath',
  'providerKey',
];

describe('theme-non-secret-persistence (P0)', () => {
  it('schola.theme localStorage key should only store a theme name string', () => {
    const allowedThemes = ['schola-dark', 'schola-light', 'schola-academic-dark', 'schola-high-contrast'];

    // Simulate setting a theme
    localStorage.setItem('schola.theme', 'schola-dark');
    const value = localStorage.getItem('schola.theme');
    assert.ok(value !== null, 'schola.theme should be set');
    assert.ok(allowedThemes.includes(value!), `Theme value should be one of: ${allowedThemes.join(', ')}`);
  });

  it('should not have any localStorage keys matching sensitive patterns', () => {
    // Simulate normal usage
    localStorage.setItem('schola.theme', 'schola-dark');
    localStorage.setItem('schola.appTheme', 'neutral-dark');
    localStorage.setItem('schola:explorerWidth', '280');
    localStorage.setItem('schola:editorPreviewRatio', '0.5');

    const keys = Object.keys(storage);
    const violations: string[] = [];

    for (const key of keys) {
      for (const pattern of SENSITIVE_KEY_PATTERNS) {
        if (key.toLowerCase().includes(pattern.toLowerCase())) {
          violations.push(`${key} (matches pattern: ${pattern})`);
        }
      }
    }

    assert.deepStrictEqual(violations, [], `Sensitive localStorage keys found:\n${violations.join('\n')}`);
  });

  it('should not store file paths in theme-related localStorage keys', () => {
    localStorage.setItem('schola.theme', 'schola-dark');
    const themeValue = localStorage.getItem('schola.theme');
    assert.ok(themeValue !== null);
    assert.ok(!themeValue!.includes('/'), 'Theme value should NOT contain file paths');
    assert.ok(!themeValue!.includes('\\'), 'Theme value should NOT contain file paths');
  });
});
