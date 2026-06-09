/**
 * IMP-11: No Extension Host / Marketplace / Monaco / Webview boundary test.
 *
 * Verifies that the codebase does not introduce any forbidden
 * extension/marketplace/Monaco/webview infrastructure.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, it } from 'vitest';

const SRC_DIR = resolve(__dirname, '..', '..', '..', 'src');

const FORBIDDEN_IMPORTS = [
  'monaco-editor',
  '@monaco-editor/react',
  'vscode',
  '@types/vscode',
  'extension-host',
  'ExtensionHost',
];

// "marketplace" / "Marketplace" are forbidden EXCEPT in plugin ecosystem
// contract types and plugin-related UI components which legitimately reference
// the marketplace *concept* (not a marketplace runtime).
const MARKETPLACE_STRINGS = ['Marketplace', 'marketplace'];
const PLUGIN_CONTRACT_EXCLUSIONS = [
  'plugin-ecosystem',
  'ai-skill-preset',
  'official-feature-module',
  'ai-workbench',
  'ProviderPage',
];

const FORBIDDEN_DIRS = [
  'extension-host',
  'marketplace',
  'webview-host',
  'monaco',
];

function collectAllFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
      results.push(...collectAllFiles(full));
    } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.tsx'))) {
      results.push(full);
    }
  }
  return results;
}

describe('ui-graph-theme-no-extension-marketplace (P0)', () => {
  it('src/ should not contain forbidden directory names', () => {
    const entries = readdirSync(SRC_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        const lower = e.name.toLowerCase();
        for (const forbidden of FORBIDDEN_DIRS) {
          assert.ok(
            !lower.includes(forbidden),
            `Should NOT have directory containing "${forbidden}": src/${e.name}`,
          );
        }
      }
    }
  });

  it('no TypeScript files should import monaco-editor or contain marketplace runtime', () => {
    const files = collectAllFiles(SRC_DIR);
    const violations: string[] = [];

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const forbidden of FORBIDDEN_IMPORTS) {
        if (content.includes(forbidden)) {
          violations.push(`${file}: ${forbidden}`);
        }
      }
      // Check marketplace strings outside plugin ecosystem contract types
      for (const mkt of MARKETPLACE_STRINGS) {
        if (content.includes(mkt)) {
          const isExcluded = PLUGIN_CONTRACT_EXCLUSIONS.some((ex) => file.includes(ex));
          if (!isExcluded) {
            violations.push(`${file}: ${mkt}`);
          }
        }
      }
    }

    assert.deepStrictEqual(
      violations,
      [],
      `Forbidden imports found:\n${violations.join('\n')}`,
    );
  });

  it('should not reference VS Code Webview host', () => {
    const files = collectAllFiles(SRC_DIR);
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('Webview') || content.includes('webview-host')) {
        violations.push(file);
      }
    }
    assert.deepStrictEqual(violations, [], 'Should NOT reference VS Code Webview host');
  });

  it('should not contain Extension Host infrastructure', () => {
    const files = collectAllFiles(SRC_DIR);
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (content.includes('ExtensionHost') || content.includes('extension-host')) {
        violations.push(file);
      }
    }
    assert.deepStrictEqual(violations, [], 'Should NOT contain Extension Host infrastructure');
  });
});
