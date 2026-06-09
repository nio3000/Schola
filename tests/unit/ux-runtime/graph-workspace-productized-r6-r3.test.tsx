/**
 * R6-R3 — Graph workspace productization.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { GraphMainView } from '../../../src/features/graph/components/GraphMainView';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('graph-workspace-productized-r6-r3', () => {
  it('renders real GraphMainView as a productized workspace', () => {
    const html = renderToStaticMarkup(
      React.createElement(GraphMainView, {
        vaultId: 'vault-1',
        isOpen: true,
        selectedFile: 'notes/current.md',
        selectedFiles: ['notes/current.md'],
        scope: 'current-file',
        onScopeChange: () => {},
        onOpenFile: () => {},
        onClose: () => {},
      }),
    );
    expect(html).toContain('graph-main-view');
    expect(html).toContain('data-graph-workspace="productized"');
    expect(html).toContain('graph-workbench');
    expect(html).toContain('graph-left-sidebar');
    expect(html).toContain('graph-main-area');
    expect(html).toContain('graph-right-panel');
  });

  it('GraphMainView keeps default current-file scope wiring', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    expect(shell).toContain("const [graphScope, setGraphScope] = useState<GraphScope>('current-file')");
    expect(shell).toContain('scope={graphScope}');
    expect(shell).not.toContain("useState<GraphScope>('whole-vault')");
  });

  it('Graph workspace preserves loading, empty, and ready canvas states', () => {
    const main = readProjectFile('src', 'features', 'graph', 'components', 'GraphMainView.tsx');
    expect(main).toContain("status === 'loading'");
    expect(main).toContain('GraphEmptyState');
    expect(main).toContain('canRenderCanvas');
    expect(main).toContain('GraphCanvas');
    expect(main).toContain('GraphLimitedNotice');
  });

  it('GraphCanvas updates selected node detail through the real callback prop', () => {
    const canvas = readProjectFile('src', 'features', 'graph', 'components', 'GraphCanvas.tsx');
    expect(canvas).toContain('onNodeClick?.(node)');
    expect(canvas).toContain('onOpenFile(node.relativePath)');
  });
});
