/**
 * Menu No shell.openExternal Test — Phase 5-3-IMP.
 *
 * TB-MENU-013: Strict check that menu code never calls shell.openExternal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const MENU_DIR = resolve(__dirname, '..', '..', '..', 'electron', 'menu');

describe('menu-no-shell-open-external (P0)', () => {
  it('TB-MENU-013: no menu file should contain shell.openExternal in code', () => {
    if (!existsSync(MENU_DIR)) return;

    const files = readdirSync(MENU_DIR).filter((f) => f.endsWith('.ts'));
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(join(MENU_DIR, file), 'utf8');
      // Filter out comment lines that mention avoiding shell.openExternal
      const lines = content.split('\n').filter(
        (l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'),
      );
      const codeOnly = lines.join('\n');
      if (codeOnly.includes('shell.openExternal')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('dialog.showMessageBox is the safe alternative used', () => {
    const dispatcher = join(MENU_DIR, 'menu-action-dispatcher.ts');
    if (existsSync(dispatcher)) {
      const content = readFileSync(dispatcher, 'utf8');
      expect(content).toContain('dialog.showMessageBox');
    }
  });
});
