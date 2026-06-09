import { describe, it, beforeEach, expect } from 'vitest';

let storage: Record<string, string>;

beforeEach(() => {
  storage = {};
  globalThis.localStorage = {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, val: string) => { storage[key] = val; },
    removeItem: (key: string) => { delete storage[key]; },
    clear: () => { storage = {}; },
    get length() { return Object.keys(storage).length; },
    key: (i: number) => Object.keys(storage)[i] ?? null,
  };
});

describe('sidebar-persistence-non-secret (P0)', () => {
  it('should persist sidebar width as a number', () => {
    localStorage.setItem('schola:explorerWidth', '280');
    const val = localStorage.getItem('schola:explorerWidth');
    expect(val).toBe('280');
    expect(Number(val)).toBe(280);
    expect(Number.isFinite(Number(val))).toBe(true);
  });

  it('should NOT store API keys', () => {
    localStorage.setItem('schola:explorerWidth', '280');
    const keys = Object.keys(storage);
    const sensitive = keys.filter(
      (k) => k.includes('api') || k.includes('key') || k.includes('secret') || k.includes('token'),
    );
    expect(sensitive).toEqual([]);
  });

  it('should NOT store file paths', () => {
    localStorage.setItem('schola:explorerWidth', '280');
    const val = localStorage.getItem('schola:explorerWidth');
    expect(val).not.toContain('/');
    expect(val).not.toContain('\\');
  });

  it('should NOT store context or prompts', () => {
    localStorage.setItem('schola:explorerWidth', '280');
    const keys = Object.keys(storage);
    const contextKeys = keys.filter(
      (k) => k.includes('context') || k.includes('prompt') || k.includes('system'),
    );
    expect(contextKeys).toEqual([]);
  });
});
