/**
 * HtmlResourceViewer — Phase 5-4A-IMP-4 (RUNTIME-FIX).
 * Safe HTML preview: sanitize + sandbox iframe.
 * No scripts, no remote assets, no event handlers.
 *
 * RUNTIME-FIX: Proper flex column layout so header, badge, path row,
 * and iframe body are clearly separated (not squashed into one line).
 */
import { type ReactElement, useState, useEffect } from 'react';
import {
  getResourceIconChar,
  getResourceKindCss,
  getResourceKindLabel,
} from './resourceDisplay';
import { getResourceKindByPath } from '../../lib/contracts/resource-classifier';
import { readHtmlResource } from '../../lib/platform/schola-api';
import { sanitizeHtml } from './htmlSanitizer';

type Phase = 'loading' | 'loaded' | 'error';

export function HtmlResourceViewer({
  vaultId,
  relativePath,
  fileName,
}: {
  readonly vaultId: string;
  readonly relativePath: string;
  readonly fileName: string;
}): ReactElement {
  const kind = getResourceKindByPath(relativePath);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [sanitized, setSanitized] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');

    (async () => {
      try {
        const r = await readHtmlResource({ vaultId, relativePath });
        if (cancelled) return;
        if (!r.ok) {
          setError(r.error);
          setPhase('error');
          return;
        }
        setSanitized(sanitizeHtml(r.html));
        setPhase('loaded');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load HTML.');
          setPhase('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vaultId, relativePath]);

  const hdr = (
    <div className="resource-viewer-header">
      <span className={`resource-viewer-icon ${getResourceKindCss(kind)}`}>
        {getResourceIconChar(kind)}
      </span>
      <span className="resource-viewer-name">{fileName}</span>
      <span className="resource-viewer-kind">{getResourceKindLabel(kind)}</span>
      <span className="resource-viewer-safe-badge" data-testid="html-safe-badge">
        Safe Preview
      </span>
    </div>
  );

  if (phase === 'loading') {
    return (
      <div className="resource-viewer resource-viewer-html" data-testid="resource-viewer-html">
        {hdr}
        <div className="resource-viewer-body">
          <p className="resource-viewer-loading">Loading HTML...</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="resource-viewer resource-viewer-html" data-testid="resource-viewer-html">
        {hdr}
        <div className="resource-viewer-body">
          <p className="resource-viewer-error">Failed to load HTML</p>
          <p className="resource-viewer-path">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="resource-viewer resource-viewer-html" data-testid="resource-viewer-html">
      {hdr}
      <div className="resource-viewer-path-row">{relativePath}</div>
      <div className="resource-viewer-body">
        <iframe
          sandbox=""
          srcDoc={sanitized}
          data-testid="html-iframe"
          title="HTML Preview"
        />
      </div>
    </div>
  );
}
