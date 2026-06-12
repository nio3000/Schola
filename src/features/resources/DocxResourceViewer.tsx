/**
 * DocxResourceViewer — Phase 5-4B-IMP-2.
 * Read-only DOCX preview: paragraph-level text extraction.
 */
import { type ReactElement, useState, useEffect } from 'react';
import { getResourceIconChar, getResourceKindCss, getResourceKindLabel } from './resourceDisplay';
import { getResourceKindByPath } from '../../lib/contracts/resource-classifier';
import { readDocxPreview } from '../../lib/platform/schola-api';
import type { DocxPreviewParagraph } from '../../lib/contracts/resource.types';

type Phase = 'loading' | 'loaded' | 'error' | 'empty';

export function DocxResourceViewer({
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
  const [paragraphs, setParagraphs] = useState<readonly DocxPreviewParagraph[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [totalParagraphs, setTotalParagraphs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    (async () => {
      try {
        const r = await readDocxPreview({ vaultId, relativePath });
        if (cancelled) return;
        if (!r.ok) { setError(r.error); setPhase('error'); return; }
        setParagraphs(r.paragraphs);
        setTruncated(r.truncated);
        setTotalParagraphs(r.totalParagraphs);
        setPhase(r.paragraphs.length === 0 ? 'empty' : 'loaded');
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load DOCX.'); setPhase('error'); }
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

  if (phase === 'loading') return <div className="resource-viewer resource-viewer-docx" data-testid="resource-viewer-docx">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-loading">Loading DOCX...</p></div></div>;
  if (phase === 'error') return <div className="resource-viewer resource-viewer-docx" data-testid="resource-viewer-docx">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-error">{error}</p></div></div>;
  if (phase === 'empty') return <div className="resource-viewer resource-viewer-docx" data-testid="resource-viewer-docx">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-placeholder">No readable text found in this DOCX file.</p></div></div>;

  const cls = (style: string) => {
    if (style === 'heading1') return 'docx-preview-heading1';
    if (style === 'heading2') return 'docx-preview-heading2';
    if (style === 'heading3') return 'docx-preview-heading3';
    return 'docx-preview-paragraph';
  };

  return (
    <div className="resource-viewer resource-viewer-docx" data-testid="resource-viewer-docx">
      {hdr}
      <div className="resource-viewer-path-row">{relativePath}</div>
      <div className="docx-preview-container">
        <div className="csv-preview-info">
          <span>Paragraphs: showing {paragraphs.length} of {totalParagraphs}</span>
        </div>
        {truncated && <p className="csv-preview-truncated">Showing first {paragraphs.length} paragraphs of {totalParagraphs} total.</p>}
        <div className="docx-preview-content">
          {paragraphs.map((p, i) => <div key={i} className={cls(p.style)}>{p.text}</div>)}
        </div>
      </div>
    </div>
  );
}
