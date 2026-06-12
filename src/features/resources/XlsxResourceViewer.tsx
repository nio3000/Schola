/**
 * XlsxResourceViewer — Phase 5-4B-IMP-2.
 * Read-only XLSX preview: sheet selector + table.
 */
import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { getResourceIconChar, getResourceKindCss, getResourceKindLabel } from './resourceDisplay';
import { getResourceKindByPath } from '../../lib/contracts/resource-classifier';
import { readXlsxPreview } from '../../lib/platform/schola-api';
import type { XlsxWorkbookPreview } from '../../lib/contracts/resource.types';

type Phase = 'loading' | 'loaded' | 'error' | 'empty';

export function XlsxResourceViewer({
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
  const [workbook, setWorkbook] = useState<XlsxWorkbookPreview | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);

  const loadSheet = useCallback(async (si: number) => {
    setPhase('loading');
    try {
      const r = await readXlsxPreview({ vaultId, relativePath, sheetIndex: si });
      if (!r.ok) { setError(r.error); setPhase('error'); return; }
      setWorkbook(r.workbook);
      setSheetIndex(r.workbook.activeSheetIndex);
      const rows = r.workbook.activeSheet.rows;
      setPhase(rows.length === 0 && r.workbook.activeSheet.totalRows === 0 ? 'empty' : 'loaded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load XLSX.');
      setPhase('error');
    }
  }, [vaultId, relativePath]);

  useEffect(() => { loadSheet(0); }, [loadSheet]);

  const hdr = (
    <div className="resource-viewer-header">
      <span className={`resource-viewer-icon ${getResourceKindCss(kind)}`}>{getResourceIconChar(kind)}</span>
      <span className="resource-viewer-name">{fileName}</span>
      <span className="resource-viewer-kind">{getResourceKindLabel(kind)}</span>
    </div>
  );

  if (phase === 'loading') return <div className="resource-viewer resource-viewer-xlsx" data-testid="resource-viewer-xlsx">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-loading">Loading XLSX...</p></div></div>;
  if (phase === 'error') return <div className="resource-viewer resource-viewer-xlsx" data-testid="resource-viewer-xlsx">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-error">{error}</p></div></div>;
  if (phase === 'empty') return <div className="resource-viewer resource-viewer-xlsx" data-testid="resource-viewer-xlsx">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-placeholder">This XLSX file contains no data.</p></div></div>;

  if (!workbook) return null;
  const sheet = workbook.activeSheet;

  return (
    <div className="resource-viewer resource-viewer-xlsx" data-testid="resource-viewer-xlsx">
      {hdr}
      <div className="resource-viewer-path-row">{relativePath}</div>
      <div className="xlsx-preview-container">
        <div className="xlsx-sheet-selector">
          <span>Sheet:</span>
          <select value={sheetIndex} onChange={(e) => loadSheet(Number(e.target.value))} data-testid="xlsx-sheet-select">
            {workbook.sheetNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select>
          <span className="csv-preview-info-span">Rows: {sheet.rows.length} of {sheet.totalRows}</span>
          <span className="csv-preview-info-span">Cols: showing {sheet.rows[0]?.length ?? 0} of {sheet.totalColumns}</span>
        </div>
        {sheet.truncatedRows && <p className="csv-preview-truncated">Showing first {sheet.rows.length} rows of {sheet.totalRows} total.</p>}
        {sheet.truncatedColumns && <p className="csv-preview-truncated">Showing first {sheet.rows[0]?.length ?? 0} columns of {sheet.totalColumns} total.</p>}
        <div className="csv-preview-table-wrap">
          <table className="csv-preview-table" data-testid="xlsx-preview-table">
            <thead>
              <tr>
                {Array.from({ length: sheet.rows[0]?.length ?? 0 }, (_, i) => <th key={i}>{colLabel(i)}</th>)}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, ri) => (
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

function colLabel(n: number): string {
  let s = '';
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
}
