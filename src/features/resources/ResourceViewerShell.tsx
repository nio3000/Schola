/**
 * Resource viewer components — Phase 5-4A-IMP-2-BATCH.
 *
 * Text Viewer, Image Viewer (placeholder), Metadata Viewer,
 * Unsupported Viewer, and the ResourceViewerShell router.
 *
 * ⚠️  PDF and HTML true previews are deferred to IMP-3 and IMP-4.
 *     All viewers are READ-ONLY.
 *     No file I/O, no network, no system paths.
 */
import type { ReactElement } from 'react';
import { useState, useEffect } from 'react';
import type { ResourceKind } from '../../lib/contracts/resource.types';
import {
  getResourceKindByPath,
  viewerKindForResourceKind,
} from '../../lib/contracts/resource-classifier';
import {
  getResourceKindLabel,
  getResourceIconChar,
  getResourceKindCss,
} from './resourceDisplay';
import { PdfResourceViewer } from './PdfResourceViewer';
import { HtmlResourceViewer } from './HtmlResourceViewer';
import { CsvResourceViewer } from './CsvResourceViewer';
import { DocxResourceViewer } from './DocxResourceViewer';
import { XlsxResourceViewer } from './XlsxResourceViewer';
import { LegacyDocResourceViewer } from './LegacyDocResourceViewer';
import { XlsResourceViewer } from './XlsResourceViewer';
import { readTextPreview } from '../../lib/platform/schola-api';

// ── Props ────────────────────────────────────────

export interface ResourceViewerShellProps {
  readonly vaultId: string;
  readonly relativePath: string;
  readonly fileName: string;
}

// ── Text Viewer ──────────────────────────────────

function TextResourceViewer({ vaultId, relativePath, fileName }: ResourceViewerShellProps): ReactElement {
  const kind = getResourceKindByPath(relativePath);
  const [phase, setPhase] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    (async () => {
      try {
        const r = await readTextPreview({ vaultId, relativePath });
        if (cancelled) return;
        if (!r.ok) { setError(r.error); setPhase('error'); return; }
        setText(r.text);
        setPhase('loaded');
      } catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : 'Failed to load text.'); setPhase('error'); }
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

  if (phase === 'loading') return <div className="resource-viewer resource-viewer-text" data-testid="resource-viewer-text">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-loading">Loading TXT...</p></div></div>;
  if (phase === 'error') return <div className="resource-viewer resource-viewer-text" data-testid="resource-viewer-text">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-error">{error}</p></div></div>;
  if (!text) return <div className="resource-viewer resource-viewer-text" data-testid="resource-viewer-text">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-placeholder">This file is empty.</p></div></div>;

  return (
    <div className="resource-viewer resource-viewer-text" data-testid="resource-viewer-text">
      {hdr}
      <div className="resource-viewer-path-row">{relativePath}</div>
      <div className="resource-viewer-body">
        <pre className="text-preview-content">{text}</pre>
      </div>
    </div>
  );
}

// ── Image Viewer (placeholder) ───────────────────

function ImageResourceViewer({ relativePath, fileName }: ResourceViewerShellProps): ReactElement {
  const kind = getResourceKindByPath(relativePath);
  return (
    <div className="resource-viewer resource-viewer-image" data-testid="resource-viewer-image">
      <div className="resource-viewer-header">
        <span className={`resource-viewer-icon ${getResourceKindCss(kind)}`}>
          {getResourceIconChar(kind)}
        </span>
        <span className="resource-viewer-name">{fileName}</span>
        <span className="resource-viewer-kind">{getResourceKindLabel(kind)}</span>
      </div>
      <div className="resource-viewer-body">
        <p className="resource-viewer-placeholder">
          Image preview will be enabled after fixed-function resource read IPC.
        </p>
        <p className="resource-viewer-path">Path: {relativePath}</p>
      </div>
    </div>
  );
}

// ── Metadata Viewer ──────────────────────────────

function MetadataResourceViewer({ relativePath, fileName }: ResourceViewerShellProps): ReactElement {
  const kind = getResourceKindByPath(relativePath);
  const viewerKind = viewerKindForResourceKind(kind);

  const deferredMsg = 'Native preview for this Office format is deferred. Metadata-only view is active.';

  return (
    <div className="resource-viewer resource-viewer-metadata" data-testid="resource-viewer-metadata">
      <div className="resource-viewer-header">
        <span className={`resource-viewer-icon ${getResourceKindCss(kind)}`}>
          {getResourceIconChar(kind)}
        </span>
        <span className="resource-viewer-name">{fileName}</span>
        <span className="resource-viewer-kind">{getResourceKindLabel(kind)}</span>
      </div>
      <div className="resource-viewer-body">
        <table className="resource-metadata-table">
          <tbody>
            <tr><td>Name</td><td>{fileName}</td></tr>
            <tr><td>Path</td><td>{relativePath}</td></tr>
            <tr><td>Type</td><td>{getResourceKindLabel(kind)}</td></tr>
            <tr><td>Viewer</td><td>{viewerKind}</td></tr>
            <tr><td>Status</td><td>Read-only</td></tr>
          </tbody>
        </table>
        <p className="resource-viewer-deferred">{deferredMsg}</p>
      </div>
    </div>
  );
}

// ── Unsupported Viewer ───────────────────────────

function UnsupportedResourceViewer({ relativePath, fileName }: ResourceViewerShellProps): ReactElement {
  return (
    <div className="resource-viewer resource-viewer-unsupported" data-testid="resource-viewer-unsupported">
      <div className="resource-viewer-header">
        <span className="resource-viewer-icon resource-kind-other">???</span>
        <span className="resource-viewer-name">{fileName}</span>
      </div>
      <div className="resource-viewer-body">
        <p className="resource-viewer-placeholder">
          This file format is not supported for preview.
        </p>
        <p className="resource-viewer-path">Path: {relativePath}</p>
      </div>
    </div>
  );
}

// ── Shell Router ─────────────────────────────────

/**
 * Resource viewer shell: routes to the correct viewer based on ResourceKind.
 */
export function ResourceViewerShell({
  vaultId,
  relativePath,
  fileName,
}: ResourceViewerShellProps): ReactElement {
  const kind: ResourceKind = getResourceKindByPath(relativePath);
  const props = { relativePath, fileName };

  switch (kind) {
    case 'txt':
      return <TextResourceViewer vaultId={vaultId} relativePath={relativePath} fileName={fileName} />;
    case 'csv':
      return <CsvResourceViewer vaultId={vaultId} relativePath={relativePath} fileName={fileName} />;
    case 'image':
      return <ImageResourceViewer {...props} />;
    case 'pdf':
      return <PdfResourceViewer vaultId={vaultId} relativePath={relativePath} fileName={fileName} />;
    case 'html':
      return <HtmlResourceViewer vaultId={vaultId} relativePath={relativePath} fileName={fileName} />;
    case 'docx':
      return <DocxResourceViewer vaultId={vaultId} relativePath={relativePath} fileName={fileName} />;
    case 'doc':
      return <LegacyDocResourceViewer vaultId={vaultId} relativePath={relativePath} fileName={fileName} />;
    case 'xlsx':
      return <XlsxResourceViewer vaultId={vaultId} relativePath={relativePath} fileName={fileName} />;
    case 'xls':
      return <XlsResourceViewer vaultId={vaultId} relativePath={relativePath} fileName={fileName} />;
    case 'pptx':
      return <MetadataResourceViewer {...props} />;
    case 'other':
    default:
      return <UnsupportedResourceViewer {...props} />;
  }
}

/**
 * Check if a path should use the resource viewer instead of the Markdown editor.
 */
export function shouldUseResourceViewer(relativePath: string): boolean {
  const kind = getResourceKindByPath(relativePath);
  return kind !== 'markdown';
}
