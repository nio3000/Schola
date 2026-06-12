/**
 * XlsResourceViewer — Phase 5-4B-LEGACY-OFFICE.
 * Read-only .xls preview using xlsx package. Sheet selector + table.
 */
import { type ReactElement, useState, useEffect, useCallback } from 'react';
import { getResourceIconChar, getResourceKindCss, getResourceKindLabel } from './resourceDisplay';
import { getResourceKindByPath } from '../../lib/contracts/resource-classifier';
import { readXlsPreview } from '../../lib/platform/schola-api';

type Phase = 'loading' | 'loaded' | 'error' | 'empty';

interface XlsWorkbook {
  sheetNames: readonly string[];
  activeSheet: {
    name: string;
    rows: readonly (readonly string[])[];
    totalRows: number;
    totalColumns: number;
    truncated: boolean;
  };
}

export function XlsResourceViewer({
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
  const [workbook, setWorkbook] = useState<XlsWorkbook | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);

  const loadSheet = useCallback(async (si: number) => {
    setPhase('loading');
    try {
      const r = await readXlsPreview({ vaultId, relativePath, sheetIndex: si });
      if (!r.ok) { setError(r.error); setPhase('error'); return; }
      setWorkbook(r.workbook);
      setSheetIndex(si);
      const rows = r.workbook.activeSheet.rows;
      setPhase(rows.length === 0 && r.workbook.activeSheet.totalRows === 0 ? 'empty' : 'loaded');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load XLS.');
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

  if (phase === 'loading') return <div className="resource-viewer resource-viewer-xls" data-testid="resource-viewer-xls">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-loading">Loading XLS...</p></div></div>;
  if (phase === 'error') return <div className="resource-viewer resource-viewer-xls" data-testid="resource-viewer-xls">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-error">{error}</p></div></div>;
  if (phase === 'empty') return <div className="resource-viewer resource-viewer-xls" data-testid="resource-viewer-xls">{hdr}<div className="resource-viewer-body"><p className="resource-viewer-placeholder">This XLS file contains no data.</p></div></div>;

  if (!workbook) return null;
  const sheet = workbook.activeSheet;

  return (
    <div className="resource-viewer resource-viewer-xls" data-testid="resource-viewer-xls">
      {hdr}
      <div className="resource-viewer-path-row">{relativePath}</div>
      <div className="xlsx-preview-container">
        <div className="xlsx-sheet-selector">
          <span>Sheet:</span>
          <select value={sheetIndex} onChange={(e) => loadSheet(Number(e.target.value))} data-testid="xls-sheet-select">
            {workbook.sheetNames.map((name, i) => <option key={i} value={i}>{name}</option>)}
          </select>
          <span className="csv-preview-info-span">Rows: {sheet.rows.length} of {sheet.totalRows}</span>
          <span className="csv-preview-info-span">Cols: {sheet.rows[0]?.length ?? 0} of {Math.min(sheet.totalColumns, 30)}</span>
        </div>
        {sheet.truncated && <p className="csv-preview-truncated">Showing limited preview of {sheet.totalRows} rows and {sheet.totalColumns} columns.</p>}
        <div className="csv-preview-table-wrap">
          <table className="csv-preview-table" data-testid="xls-preview-table">
            <thead><tr>{sheet.rows[0]?.map((_, i) => <th key={i}>{col(i)}</th>)}</tr></thead>
            <tbody>{sheet.rows.slice(1).map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function col(n: number): string { let s=''; while(n>=0){s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26)-1;} return s; }
