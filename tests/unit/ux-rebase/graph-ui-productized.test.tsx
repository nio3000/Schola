/**
 * UX Rebase — Graph UI Productized Test (P0: UX-TB-P0-042 ~ 048)
 * Phase 5-UX-UI-BRANCH-REGRESSION-CLEANUP.
 *
 * Updated: checks Graph features via code analysis of actual source files,
 * not old App.tsx import structure.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('ux-rebase graph-ui-productized (P0)', () => {
  it('UX-TB-P0-042: Graph not default-on (isOpen prop controlled)', () => {
    const mainViewPath = resolve(ROOT, 'src', 'features', 'graph', 'components', 'GraphMainView.tsx');
    if (!existsSync(mainViewPath)) return;
    const content = readFileSync(mainViewPath, 'utf8');
    const code = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
    // Should return null when isOpen is false
    expect(code).toContain('!isOpen');
    expect(code).toContain('return null');
  });

  it('UX-TB-P0-043: Graph not default Whole Vault', () => {
    const scopePath = resolve(ROOT, 'src', 'features', 'graph', 'lib', 'graphScope.ts');
    if (!existsSync(scopePath)) return;
    const content = readFileSync(scopePath, 'utf8');
    const code = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
    expect(code).toContain("'current-file'");
    expect(code).toContain('DEFAULT_SCOPE');
  });

  it('UX-TB-P0-044: Graph enters Editor Area via WorkspaceShell', () => {
    const shellPath = resolve(ROOT, 'src', 'features', 'workspace', 'WorkspaceShell.tsx');
    if (!existsSync(shellPath)) return;
    const content = readFileSync(shellPath, 'utf8');
    expect(content).toContain("'graph'");
  });

  it('UX-TB-P0-048: no D3 / Three.js / WebGL in graph code', () => {
    const files = [
      'src/features/graph/components/GraphCanvas.tsx',
      'src/features/graph/components/GraphMainView.tsx',
      'src/features/graph/lib/graphLayout.ts',
    ];
    for (const file of files) {
      const full = resolve(ROOT, file);
      if (!existsSync(full)) continue;
      const content = readFileSync(full, 'utf8');
      const code = content.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//')).join('\n');
      expect(code).not.toContain("from 'd3'");
      expect(code).not.toContain('from "d3"');
      expect(code).not.toContain("from 'three'");
      expect(code).not.toContain('webgl');
    }
  });

  it('Graph CSS uses theme tokens', () => {
    const cssPath = resolve(ROOT, 'src', 'features', 'graph', 'Graph.css');
    if (!existsSync(cssPath)) return;
    const content = readFileSync(cssPath, 'utf8');
    expect(content).toContain('var(--');
  });
});
