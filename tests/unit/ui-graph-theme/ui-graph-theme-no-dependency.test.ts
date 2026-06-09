/**
 * IMP-11: No dependency expansion test.
 *
 * Verifies that package.json has not been modified by this phase —
 * no new npm dependencies were added for UI/Graph/Theme work.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';

const PKG_PATH = resolve(__dirname, '..', '..', '..', 'package.json');

interface PackageJson {
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

const FORBIDDEN_DEPS = [
  'd3',
  'three',
  '@types/d3',
  '@types/three',
  'three.js',
  'd3-force',
  'd3-hierarchy',
  'dagre',
  'elkjs',
  'vis-network',
  'vis-data',
  'cytoscape',
  'sigma',
  'graphology',
  'monaco-editor',
  '@monaco-editor/react',
  'material-icon-theme',
  'vscode-material-icon-theme',
  'bearded-theme',
  'vsce',
  '@vscode/webview',
  'lucide-react',
  'heroicons',
  '@heroicons/react',
  'font-awesome',
  '@fortawesome/react-fontawesome',
];

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(PKG_PATH, 'utf8')) as PackageJson;
}

describe('ui-graph-theme-no-dependency (P0)', () => {
  it('should not add forbidden graph/icon/theme/Monaco/Marketplace dependencies', () => {
    const pkg = readPackageJson();
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const violations: string[] = [];

    for (const forbidden of FORBIDDEN_DEPS) {
      if (forbidden in allDeps) {
        violations.push(forbidden);
      }
    }

    assert.deepStrictEqual(violations, [], `Forbidden dependencies found: ${violations.join(', ')}`);
  });

  it('should not have d3 listed', () => {
    const pkg = readPackageJson();
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.ok(!('d3' in allDeps), 'd3 should NOT be a dependency');
  });

  it('should not have three listed', () => {
    const pkg = readPackageJson();
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.ok(!('three' in allDeps), 'three.js should NOT be a dependency');
  });

  it('should not have monaco-editor listed', () => {
    const pkg = readPackageJson();
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    assert.ok(!('monaco-editor' in allDeps), 'monaco-editor should NOT be a dependency');
  });

  it('should not add any theme library dependencies', () => {
    const pkg = readPackageJson();
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const themeDeps = ['bearded-theme', 'material-icon-theme', 'vscode-material-icon-theme'];
    for (const dep of themeDeps) {
      assert.ok(!(dep in allDeps), `${dep} should NOT be a dependency`);
    }
  });
});
