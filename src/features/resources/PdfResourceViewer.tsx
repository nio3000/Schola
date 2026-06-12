/**
 * PdfResourceViewer — Phase 5-4A-PDF-READING-MODE.
 *
 * Single-page continuous scroll reading mode.
 * Each page is rendered as a separate canvas block, stacked vertically.
 * Mouse wheel scrolling for natural reading — no Next button required.
 *
 * Three-tier rendering (from R2B):
 *   Tier A: pdfjs-dist + explicit Worker port
 *   Tier B: pdfjs-dist + fake worker
 *   Tier C: native Blob iframe (guaranteed)
 *
 * Limits: max 20 pages in continuous mode. Beyond that, first 20 rendered
 * with a notice. Virtual scrolling deferred to R3.
 */
import { type ReactElement, useState, useEffect, useRef, useCallback } from 'react';
import { getResourceIconChar, getResourceKindCss } from './resourceDisplay';
import { getResourceKindByPath } from '../../lib/contracts/resource-classifier';
import { readPdfResource } from '../../lib/platform/schola-api';

type Phase = 'loading' | 'loaded' | 'error';
type PdfRuntimeMode = 'pdfjs-worker' | 'pdfjs-fake-worker' | 'native-blob';
type PdfAttemptedModes = PdfRuntimeMode[];

const MAX_CONTINUOUS_PAGES = 20;

export function PdfResourceViewer({
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
  const [scale, setScale] = useState(1.0);
  const [runtimeMode, setRuntimeMode] = useState<PdfRuntimeMode | null>(null);
  const [attemptedModes, setAttemptedModes] = useState<PdfAttemptedModes>([]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [renderedPages, setRenderedPages] = useState(0);
  const docRef = useRef<unknown>(null);
  const pageRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  // ── Cleanup blob URL ──────────────────────────
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // ── Register canvas ref ──────────────────────
  const registerCanvas = useCallback((pageNum: number, el: HTMLCanvasElement | null) => {
    if (el) {
      pageRefs.current.set(pageNum, el);
    } else {
      pageRefs.current.delete(pageNum);
    }
  }, []);

  // ── Tier A ────────────────────────────────────
  const tryPdfjsWorker = useCallback(async (bytes: ArrayBuffer): Promise<boolean> => {
    try {
      const pdfjsMod = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const pdfjsLib = pdfjsMod as Record<string, unknown>;
      let worker: Worker | null = null;
      try {
        worker = new Worker(
          new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url),
          { type: 'module' },
        );
      } catch { return false; }
      const PDFWorkerCtor = pdfjsLib.PDFWorker as
        | (new (opts: { port: Worker }) => unknown)
        | undefined;
      if (!PDFWorkerCtor) return false;
      const pdfWorker = new PDFWorkerCtor({ port: worker });
      const getDocFn = pdfjsLib.getDocument as (
        o: Record<string, unknown>,
      ) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<unknown> }> };
      const doc = await getDocFn({
        data: new Uint8Array(bytes),
        disableScripting: true,
        worker: pdfWorker,
      }).promise;
      if (doc && doc.numPages > 0) { docRef.current = doc; setTotalPages(doc.numPages); return true; }
      return false;
    } catch { return false; }
  }, []);

  // ── Tier B ────────────────────────────────────
  const tryPdfjsFakeWorker = useCallback(async (bytes: ArrayBuffer): Promise<boolean> => {
    try {
      const pdfjsMod = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const pdfjsLib = pdfjsMod as Record<string, unknown>;
      await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
      const getDocFn = pdfjsLib.getDocument as (
        o: Record<string, unknown>,
      ) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<unknown> }> };
      const doc = await getDocFn({
        data: new Uint8Array(bytes),
        disableScripting: true,
      }).promise;
      if (doc && doc.numPages > 0) { docRef.current = doc; setTotalPages(doc.numPages); return true; }
      return false;
    } catch { return false; }
  }, []);

  // ── Tier C ────────────────────────────────────
  const tryNativeBlob = useCallback((bytes: ArrayBuffer): boolean => {
    try {
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return true;
    } catch { return false; }
  }, []);

  // ── Main load ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setError('');
    setRuntimeMode(null);
    setAttemptedModes([]);
    setBlobUrl(null);
    setTotalPages(0);
    setRenderedPages(0);
    docRef.current = null;
    pageRefs.current.clear();

    (async () => {
      const r = await readPdfResource({ vaultId, relativePath });
      if (cancelled) return;
      if (!r.ok) { setError(r.error || 'Failed to read PDF.'); setPhase('error'); return; }
      const bytes = r.bytes;
      const tried: PdfAttemptedModes = [];

      tried.push('pdfjs-worker'); setAttemptedModes([...tried]);
      if (await tryPdfjsWorker(bytes)) { if (cancelled) return; setRuntimeMode('pdfjs-worker'); setAttemptedModes([...tried]); setPhase('loaded'); return; }

      tried.push('pdfjs-fake-worker'); setAttemptedModes([...tried]);
      if (await tryPdfjsFakeWorker(bytes)) { if (cancelled) return; setRuntimeMode('pdfjs-fake-worker'); setAttemptedModes([...tried]); setPhase('loaded'); return; }

      tried.push('native-blob'); setAttemptedModes([...tried]);
      if (tryNativeBlob(bytes)) { if (cancelled) return; setRuntimeMode('native-blob'); setAttemptedModes([...tried]); setPhase('loaded'); return; }

      if (!cancelled) { setError('All rendering methods failed.'); setPhase('error'); }
    })();
    return () => { cancelled = true; };
  }, [vaultId, relativePath, tryPdfjsWorker, tryPdfjsFakeWorker, tryNativeBlob]);

  // ── Render all pages (pdfjs modes, continuous) ─
  useEffect(() => {
    if (phase !== 'loaded') return;
    if (runtimeMode === 'native-blob' || runtimeMode === null) return;

    const doc = docRef.current as {
      numPages: number;
      getPage: (n: number) => Promise<{
        render: (o: Record<string, unknown>) => { promise: Promise<void> };
        getViewport: (o: { scale: number }) => { width: number; height: number };
      }>;
    } | null;
    if (!doc) return;

    const limit = Math.min(doc.numPages, MAX_CONTINUOUS_PAGES);
    setRenderedPages(limit);

    let cancelled = false;

    (async () => {
      for (let pn = 1; pn <= limit; pn++) {
        if (cancelled) break;
        const canvas = pageRefs.current.get(pn);
        if (!canvas) continue;
        try {
          const page = await doc.getPage(pn);
          if (cancelled) break;
          const viewport = page.getViewport({ scale });
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
        } catch {
          // individual page render failure — skip
        }
      }
    })();

    return () => { cancelled = true; };
  }, [phase, scale, runtimeMode]);

  // ── Header ─────────────────────────────────────
  const readingMode = runtimeMode === 'native-blob' ? 'Native PDF Viewer' : 'Single Page Scroll';
  const hdr = (
    <div className="resource-viewer-header">
      <span className={`resource-viewer-icon ${getResourceKindCss(kind)}`}>{getResourceIconChar(kind)}</span>
      <span className="resource-viewer-name">{fileName}</span>
      <span className="resource-viewer-kind">PDF</span>
      {runtimeMode && (
        <span className="resource-viewer-mode-badge" data-testid="pdf-mode-badge">{runtimeMode}</span>
      )}
    </div>
  );

  // ── Loading ────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="resource-viewer resource-viewer-pdf" data-testid="resource-viewer-pdf">
        {hdr}
        <div className="resource-viewer-body">
          <p className="resource-viewer-loading">Loading PDF...</p>
          <p className="resource-viewer-path">Trying: {attemptedModes.join(' → ') || '...'}</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="resource-viewer resource-viewer-pdf" data-testid="resource-viewer-pdf">
        {hdr}
        <div className="resource-viewer-body">
          <p className="resource-viewer-error">{error}</p>
          {attemptedModes.length > 0 && (
            <div className="resource-viewer-diagnostic">
              <table className="resource-metadata-table">
                <tbody>
                  <tr><td>Modes tried</td><td>{attemptedModes.join(' → ')}</td></tr>
                  <tr><td>File</td><td>{fileName}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Loaded: native-blob iframe ─────────────────
  if (runtimeMode === 'native-blob' && blobUrl) {
    return (
      <div className="resource-viewer resource-viewer-pdf" data-testid="resource-viewer-pdf">
        {hdr}
        <div className="resource-viewer-path-row">{relativePath}</div>
        <div className="resource-viewer-toolbar">
          <span className="pdf-reading-mode-label">Mode: {readingMode}</span>
          <span className="resource-viewer-mode-badge">native-blob</span>
        </div>
        <div className="resource-viewer-body" style={{ padding: 0, overflow: 'hidden' }}>
          <iframe src={blobUrl} title={fileName} className="pdf-native-frame" data-testid="pdf-native-frame" />
        </div>
      </div>
    );
  }

  // ── Loaded: continuous scroll (pdfjs canvas) ───
  const pagesToShow = Math.min(totalPages, MAX_CONTINUOUS_PAGES);
  const pageNumbers = Array.from({ length: pagesToShow }, (_, i) => i + 1);

  return (
    <div className="resource-viewer resource-viewer-pdf" data-testid="resource-viewer-pdf">
      {hdr}
      <div className="resource-viewer-path-row">{relativePath}</div>
      <div className="resource-viewer-toolbar">
        <span className="pdf-reading-mode-label">Mode: {readingMode}</span>
        <span className="pdf-page-count-label">Pages: {totalPages}</span>
        {totalPages > MAX_CONTINUOUS_PAGES && (
          <span className="pdf-truncation-notice">
            Showing first {MAX_CONTINUOUS_PAGES} of {totalPages}
          </span>
        )}
        <button onClick={() => setScale((s) => Math.max(0.5, s - 0.25))} data-testid="pdf-zoom-out">-</button>
        <button onClick={() => setScale((s) => Math.min(2, s + 0.25))} data-testid="pdf-zoom-in">+</button>
        <span className="pdf-scale-label">{Math.round(scale * 100)}%</span>
        <span className="resource-viewer-mode-badge" data-testid="pdf-mode-badge">{runtimeMode}</span>
      </div>
      <div className="pdf-continuous-scroll" data-testid="pdf-continuous-scroll">
        {totalPages > MAX_CONTINUOUS_PAGES && (
          <div className="pdf-truncation-banner">
            This PDF has {totalPages} pages. Showing first {MAX_CONTINUOUS_PAGES} pages in continuous mode.
            Full-document virtual scrolling is planned for a future update.
          </div>
        )}
        <div className="pdf-page-list">
          {pageNumbers.map((pn) => (
            <div key={`${pn}-${scale}`} className="pdf-page-frame" data-testid={`pdf-page-${pn}`}>
              <span className="pdf-page-label">Page {pn}</span>
              <canvas
                ref={(el) => registerCanvas(pn, el)}
                className="pdf-page-canvas"
                data-testid={`pdf-canvas-${pn}`}
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
