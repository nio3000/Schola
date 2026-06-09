import type { ReactElement } from 'react';
import type { WikiIndexSnapshot } from '../lib/wikiIndex';

export interface BacklinksPanelProps {
  readonly currentFilePath: string | null;
  readonly wikiIndex: WikiIndexSnapshot;
  readonly onOpenBacklink: (relativePath: string) => void;
  /** Optional pre-resolved backlinks (from SQLite hook). Overrides wikiIndex when provided. */
  readonly backlinks?: readonly string[];
  /** Data source for E2E observability. Not visible in UI. */
  readonly backlinksSource?: 'sqlite' | 'memory';
  /** Fallback reason for E2E observability. Not visible in UI. */
  readonly backlinksFallbackReason?: string;
}

function displayName(relativePath: string): string {
  return relativePath.split('/').pop() ?? relativePath;
}

export function BacklinksPanel({
  currentFilePath,
  wikiIndex,
  onOpenBacklink,
  backlinks: resolvedBacklinks,
  backlinksSource,
  backlinksFallbackReason,
}: BacklinksPanelProps): ReactElement | null {
  if (!currentFilePath) {
    return null;
  }

  const backlinks = resolvedBacklinks ?? (wikiIndex.data.incomingByPath[currentFilePath] ?? []);
  const isIndexing = resolvedBacklinks ? false : wikiIndex.status === 'indexing';

  return (
    <aside
      className="backlinks-panel schola-scrollbar"
      data-testid="backlinks-panel"
      data-backlinks-source={backlinksSource}
      data-backlinks-fallback-reason={backlinksFallbackReason}
      aria-label="Backlinks"
    >
      <div className="backlinks-header">
        <span className="backlinks-title">Backlinks</span>
        {!isIndexing && (
          <span className="backlinks-count" data-testid="backlinks-count">
            {backlinks.length}
          </span>
        )}
      </div>

      {isIndexing ? (
        <p className="backlinks-indexing" data-testid="backlinks-indexing">
          Indexing links...
        </p>
      ) : backlinks.length > 0 ? (
        <ul className="backlinks-list" role="list" aria-label="Backlink items">
          {backlinks.map((filePath) => (
            <li key={filePath} className="backlinks-item">
              <button
                type="button"
                className="backlinks-link"
                data-testid={`backlink-${displayName(filePath)}`}
                title={filePath}
                onClick={() => onOpenBacklink(filePath)}
              >
                {displayName(filePath)}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="backlinks-empty" data-testid="backlinks-empty">
          No backlinks yet.
        </p>
      )}
    </aside>
  );
}
