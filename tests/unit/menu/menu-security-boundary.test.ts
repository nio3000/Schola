/**
 * Menu Security Boundary Test — Phase 5-3-IMP.
 *
 * TB-MENU-013, 014, 015, 016, 017, 018, 019, 020: Security boundaries.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readIfExists(relativePath: string): string | null {
  const full = resolve(ROOT, relativePath);
  if (existsSync(full)) return readFileSync(full, 'utf8');
  return null;
}

describe('menu-security-boundary (P0)', () => {
  it('TB-MENU-013: should not use shell.openExternal in menu code', () => {
    const files = [
      'electron/menu/menu-action-dispatcher.ts',
      'electron/menu/menu-template.ts',
      'electron/menu/app-menu.service.ts',
    ];
    for (const file of files) {
      const content = readIfExists(file);
      if (content) {
        // Only check code lines, not comments mentioning "not use shell.openExternal"
        const lines = content.split('\n').filter(
          (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'),
        );
        const codeOnly = lines.join('\n');
        expect(codeOnly).not.toContain('shell.openExternal');
      }
    }
  });

  it('TB-MENU-014: should not expose API keys in menu code', () => {
    const files = [
      'electron/menu/menu-action-dispatcher.ts',
      'electron/menu/menu-template.ts',
      'electron/menu/menu-labels.ts',
    ];
    for (const file of files) {
      const content = readIfExists(file);
      if (content) {
        expect(content).not.toContain('apiKey');
        expect(content).not.toContain('API_KEY');
        expect(content).not.toContain('secret');
      }
    }
  });

  it('TB-MENU-019: menu code should not write to Vault', () => {
    const dispatcher = readIfExists('electron/menu/menu-action-dispatcher.ts');
    if (dispatcher) {
      expect(dispatcher).not.toContain('writeFile');
      expect(dispatcher).not.toContain('appendFile');
      expect(dispatcher).not.toContain('createWriteStream');
      expect(dispatcher).not.toContain('saveToVault');
      expect(dispatcher).not.toContain('exportArtifact');
    }
  });

  it('TB-MENU-020: menu code should not trigger real export', () => {
    const dispatcher = readIfExists('electron/menu/menu-action-dispatcher.ts');
    if (dispatcher) {
      expect(dispatcher).not.toContain('export:');
      expect(dispatcher).not.toContain('EXPORT_');
    }
  });

  it('TB-MENU-017: menu code should not trigger provider invocation', () => {
    const dispatcher = readIfExists('electron/menu/menu-action-dispatcher.ts');
    if (dispatcher) {
      expect(dispatcher).not.toContain('provider:invoke');
      expect(dispatcher).not.toContain('runTask');
      expect(dispatcher).not.toContain('sendContext');
    }
  });

  it('TB-MENU-005: should not implement Command Palette or Keybindings system', () => {
    const menuDir = resolve(ROOT, 'electron', 'menu');
    const files = existsSync(menuDir) ? require('node:fs').readdirSync(menuDir) : [];
    for (const file of files) {
      const content = readIfExists(`electron/menu/${file}`);
      if (content) {
        // Filter comments to avoid false positives
        const lines = content.split('\n').filter(
          (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'),
        );
        const codeOnly = lines.join('\n');
        // Check for actual implementations, not command ID strings
        expect(codeOnly).not.toContain('globalShortcut');
        expect(codeOnly).not.toContain('keybinding-manager');
        expect(codeOnly).not.toContain('command-palette');
        // "Keybindings" and "keybindings" may appear as command IDs which is fine
      }
    }
  });
});
