/**
 * CsvResourceViewer — Phase 5-4B-IMP-1.
 * Read-only CSV preview: table with fallback to raw text.
 */
import { type ReactElement, useState, useEffect } from 'react';
import { getResourceIconChar, getResourceKindCss, getResourceKindLabel } from './resourceDisplay';
import { getResourceKindByPath } from '../../lib/contracts/resource-classifier';
import { readTextPreview } from '../../lib/platform/schola-api';
import { parseCsv } from './csvParser';
import type { CsvParsed } from './csvParser';

type Phase = 'loading' | 'loaded-table' | 'loaded-fallback' | 'error' | 'empty';

export function CsvResourceViewer({
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
  const [fallbackText, setFallbackText] = useState('');
  const [parsed, setParsed] = useState<CsvParsed | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    setParsed(null);
    setFallbackText('');

    (async () => {
      try {
        const r = await readTextPreview({ vaultId, relativePath });
        if (cancelled) return;
        if (!r.ok) {
          setError(r.error);
          setPhase('error');
          return;
        }

        const result = parseCsv(r.text);
        if (cancelled) return;

        if (result.ok) {
          setParsed(result);
          setPhase('loaded-table');
        } else {
          setFallbackText(r.text);
          setPhase('loaded-fallback');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load CSV.');
          setPhase('error');
        }
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

  if (phase === 'loading') {
    return <div className="resource-viewer resource-viewer-csv" data-testid="resource-viewer-csv">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-loading">Loading CSV...</p></div></div>;
  }

  if (phase === 'error') {
    return <div className="resource-viewer resource-viewer-csv" data-testid="resource-viewer-csv">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-error">{error}</p></div></div>;
  }

  if (phase === 'loaded-fallback') {
    return (
      <div className="resource-viewer resource-viewer-csv" data-testid="resource-viewer-csv">
        {hdr}
        <div className="resource-viewer-path-row">{relativePath}</div>
        <div className="csv-preview-fallback">
          <p className="resource-viewer-placeholder">CSV table preview failed. Showing raw text instead.</p>
        </div>
        <div className="resource-viewer-body">
          <pre className="text-preview-content">{fallbackText}</pre>
        </div>
      </div>
    );
  }

  if (parsed) {
    return (
      <div className="resource-viewer resource-viewer-csv" data-testid="resource-viewer-csv">
        {hdr}
        <div className="resource-viewer-path-row">{relativePath}</div>
        <div className="csv-preview-container">
          <div className="csv-preview-info">
            <span>Rows: showing {parsed.rows.length} of {parsed.totalRows}</span>
            <span>Columns: showing {parsed.headers.length} of {parsed.totalColumns}</span>
          </div>
          {parsed.truncatedRows && <p className="csv-preview-truncated">Showing first {parsed.rows.length} data rows of {parsed.totalRows} total.</p>}
          {parsed.truncatedColumns && <p className="csv-preview-truncated">Showing first {parsed.headers.length} columns of {parsed.totalColumns} total.</p>}
          <div className="csv-preview-table-wrap">
            <table className="csv-preview-table" data-testid="csv-preview-table">
              <thead>
                <tr>
                  {parsed.headers.map((h, i) => <th key={i}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return <div className="resource-viewer resource-viewer-csv" data-testid="resource-viewer-csv">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-placeholder">This CSV file is empty.</p></div></div>;
}
