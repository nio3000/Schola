/**
 * LegacyDocResourceViewer — Phase 5-4B-DOC-CONTENT-IMP.
 * Read-only .doc plain-text preview using word-extractor.
 */
import { type ReactElement, useState, useEffect } from 'react';
import { getResourceIconChar, getResourceKindCss, getResourceKindLabel } from './resourceDisplay';
import { getResourceKindByPath } from '../../lib/contracts/resource-classifier';
import { readDocPreview } from '../../lib/platform/schola-api';

type Phase = 'loading' | 'loaded' | 'error' | 'empty';

export function LegacyDocResourceViewer({
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
  const [text, setText] = useState('');
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    (async () => {
      try {
        const r = await readDocPreview({ vaultId, relativePath });
        if (cancelled) return;
        if (!r.ok) { setError(r.error); setPhase('error'); return; }
        setText(r.text);
        setTruncated(r.truncated);
        setPhase(r.text.length === 0 ? 'empty' : 'loaded');
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'DOC preview failed.'); setPhase('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [vaultId, relativePath]);

  const hdr = (
    <div className="resource-viewer-header">
      <span className={`resource-viewer-icon ${getResourceKindCss(kind)}`}>{getResourceIconChar(kind)}</span>
      <span className="resource-viewer-name">{fileName}</span>
      <span className="resource-viewer-kind">{getResourceKindLabel(kind)}</span>
    </div>
  );

  if (phase === 'loading') return <div className="resource-viewer resource-viewer-doc" data-testid="resource-viewer-legacy-doc">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-loading">Loading DOC...</p></div></div>;
  if (phase === 'error') return <div className="resource-viewer resource-viewer-doc" data-testid="resource-viewer-legacy-doc">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-error">{error}</p></div></div>;
  if (phase === 'empty') return <div className="resource-viewer resource-viewer-doc" data-testid="resource-viewer-legacy-doc">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-placeholder">No readable text found in this DOC file.</p><p className="resource-viewer-placeholder">Please convert this file to .docx for full preview.</p></div></div>;

  return (
    <div className="resource-viewer resource-viewer-doc" data-testid="resource-viewer-legacy-doc">
      {hdr}
      <div className="resource-viewer-path-row">{relativePath}</div>
      <div className="resource-viewer-body">
        <p className="resource-viewer-placeholder">Legacy Word plain-text preview. For full formatting, convert this file to .docx.</p>
        {truncated && <p className="csv-preview-truncated">Text truncated to 500,000 characters.</p>}
        <pre className="text-preview-content">{text}</pre>
      </div>
    </div>
  );
}
