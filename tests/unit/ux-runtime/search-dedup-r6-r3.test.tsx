/**
 * R6-R3 — Search deduplication.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { TopBar } from '../../../src/features/workspace/TopBar';
import { SearchPanel } from '../../../src/features/search/components/SearchPanel';
import { ACTIVITY_BAR_ITEMS } from '../../../src/features/workspace/ActivityBar';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('search-dedup-r6-r3', () => {
  it('renders the top Command Center as the only global search input', () => {
    const html = renderToStaticMarkup(
      React.createElement(TopBar, {
        fileName: 'paper.md',
        searchQuery: 'federated',
        onOpenSearch: () => {},
        onSearchQueryChange: () => {},
      }),
    );
    expect(html).toContain('topbar-command-center');
    expect(html).toContain('topbar-command-input');
    expect(html).toContain('type="search"');
    expect(html).toContain('value="federated"');
  });

  it('does not keep a duplicate Search button in the ActivityBar', () => {
    expect(ACTIVITY_BAR_ITEMS.some((item) => item.testid === 'activity-search')).toBe(false);
  });

  it('Search Activity renders results and metadata without a second main input', () => {
    const html = renderToStaticMarkup(
      React.createElement(SearchPanel, {
        query: 'graph',
        matches: [{
          relativePath: 'notes/graph.md',
          matchedText: 'Graph workspace',
          matchType: 'heading',
          rank: 1,
        }],
        onOpenFile: () => {},
        onClose: () => {},
        searchSource: 'sqlite',
        searchIndexReady: true,
      }),
    );
    expect(html).toContain('data-search-role="results-panel"');
    expect(html).toContain('search-query-summary');
    expect(html).toContain('search-filter-strip');
    expect(html).toContain('search-results');
    expect(html).not.toContain('data-testid="search-input"');
    expect(html).not.toContain('placeholder="搜索文件名、路径、标题、链接..."');
  });

  it('SearchPanel still exposes result click wiring for opening files', () => {
    const source = readProjectFile('src', 'features', 'search', 'components', 'SearchPanel.tsx');
    expect(source).toContain('onOpenFile(match.relativePath)');
    expect(source).toContain('onClose()');
    expect(source).toContain('role="listbox"');
  });

  it('WorkspaceShell keeps Search modal-only and does not replace the editor region', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    const sideBar = readProjectFile('src', 'features', 'workspace', 'SideBar.tsx');
    expect(shell).toContain("onOpenSearch={() => setSearchModalOpen(true)}");
    expect(shell).toContain('onSearchQueryChange={handleSearchQueryChange}');
    expect(shell).toContain('searchModalOpen ? (');
    expect(shell).toContain('<SearchPanel');
    expect(sideBar).not.toContain("case 'search':");
    expect(sideBar).not.toContain('workspace-sidebar-search');
    expect(shell).not.toContain("activeActivity === 'search' ? (");
    expect(shell).toContain('data-testid="editor-region"');
  });
});
