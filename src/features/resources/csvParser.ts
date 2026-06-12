/**
 * CSV parser — Phase 5-4B-IMP-1.
 * Pure function, zero dependencies. Simple comma-separated parsing
 * with basic quote support. Falls back to text on parse failure.
 */

export interface CsvParsed {
  ok: true;
  headers: string[];
  rows: string[][];
  totalRows: number;
  totalColumns: number;
  truncatedRows: boolean;
  truncatedColumns: boolean;
}

export interface CsvParseError {
  ok: false;
  error: string;
}

export type CsvParseResult = CsvParsed | CsvParseError;

const DEFAULT_MAX_ROWS = 200;
const DEFAULT_MAX_COLS = 50;

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
  }
  cells.push(cell.trim());
  return cells;
}

export function parseCsv(
  text: string,
  options?: { maxRows?: number; maxCols?: number },
): CsvParseResult {
  const maxRows = options?.maxRows ?? DEFAULT_MAX_ROWS;
  const maxCols = options?.maxCols ?? DEFAULT_MAX_COLS;

  if (!text || text.trim().length === 0) {
    return { ok: false, error: 'CSV file is empty.' };
  }

  const lines = text.split('\n');
  if (lines.length === 0) {
    return { ok: false, error: 'CSV file is empty.' };
  }

  try {
    const allRows = lines.filter((l) => l.trim().length > 0).map(splitRow);
    const totalRows = allRows.length;

    if (totalRows === 0) {
      return { ok: false, error: 'CSV file contains no data rows.' };
    }

    const headers = allRows[0];
    const totalColumns = headers.length;

    const dataRows = allRows.slice(1, maxRows + 1);
    const truncatedRows = totalRows > maxRows + 1; // +1 for header
    const truncatedColumns = totalColumns > maxCols;

    const limitedRows = dataRows.map((row) => row.slice(0, maxCols));
    const limitedHeaders = headers.slice(0, maxCols);

    return {
      ok: true,
      headers: limitedHeaders,
      rows: limitedRows,
      totalRows: totalRows - 1, // exclude header
      totalColumns,
      truncatedRows,
      truncatedColumns,
    };
  } catch {
    return { ok: false, error: 'CSV parsing failed.' };
  }
}
