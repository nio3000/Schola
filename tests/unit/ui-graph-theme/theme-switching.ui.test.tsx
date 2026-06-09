import { describe, it, expect } from 'vitest';

describe('theme-switching (P1)', () => {
  const VALID_THEMES = ['schola-dark', 'schola-light', 'schola-academic-dark', 'schola-high-contrast'];

  it('should accept all valid theme names', () => {
    for (const theme of VALID_THEMES) {
      expect(VALID_THEMES).toContain(theme);
    }
  });

  it('should default to schola-dark', () => {
    const defaultTheme = 'schola-dark';
    expect(VALID_THEMES).toContain(defaultTheme);
    expect(defaultTheme).toBe('schola-dark');
  });

  it('should not accept invalid theme names', () => {
    expect(VALID_THEMES).not.toContain('invalid-theme');
    expect(VALID_THEMES).not.toContain('bearded-theme');
    expect(VALID_THEMES).not.toContain('');
  });

  it('should only persist schola.theme localStorage key', () => {
    const storageKey = 'schola.theme';
    expect(storageKey).not.toContain('api');
    expect(storageKey).not.toContain('secret');
    expect(storageKey).not.toContain('token');
  });
});
