/**
 * Office Preview Service — Phase 5-4B-IMP-2.
 *
 * DOCX and XLSX read-only content extraction using jszip.
 * All parsing happens in main process. Renderer never touches jszip.
 *
 * Security constraints (from DEP-RISK):
 *  1. jszip only in main process
 *  2. Original file ≤ 20MB
 *  3. ZIP entry count ≤ 500
 *  4. Single XML entry expanded ≤ 30MB
 *  5. Total expanded ≤ 100MB
 *  7. Whitelist entries only
 *  11. RegEx + simple SAX, no XML parser library
 *  12. No system absolute paths returned
 *  13. Errors sanitized
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';

// ── Constants ─────────────────────────────────────

const MAX_OFFICE_FILE_SIZE = 20 * 1024 * 1024;
const MAX_ZIP_ENTRY_COUNT = 500;
const MAX_SINGLE_XML_EXPANDED = 30 * 1024 * 1024;
const MAX_TOTAL_EXPANDED = 100 * 1024 * 1024;
const MAX_DOCX_PARAGRAPHS = 5000;
const MAX_XLSX_SHEETS = 30;
const MAX_XLSX_ROWS = 100;
const MAX_XLSX_COLS = 30;

const DOCX_WHITELIST = new Set(['word/document.xml']);
const XLSX_WHITELIST = new Set([
  'xl/workbook.xml',
  'xl/sharedStrings.xml',
  'xl/_rels/workbook.xml.rels',
]);

function xlsxSheetWhitelisted(name: string): boolean {
  return /^xl\/worksheets\/sheet\d+\.xml$/.test(name);
}

// ── Errors ─────────────────────────────────────────

function hasZipMagic(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    ((buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[2] === 0x05 && buffer[3] === 0x06) ||
      (buffer[2] === 0x07 && buffer[3] === 0x08))
  );
}

function sanitizeOfficeError(kind: 'docx' | 'xlsx'): string {
  return kind === 'docx'
    ? 'DOCX preview failed. The file may be corrupted or not a valid DOCX file.'
    : 'XLSX preview failed. The file may be corrupted or not a valid XLSX file.';
}

function sanitize(msg: string): string {
  const s = msg.replace(/[A-Z]:\\.*?(?=\s|$)/gi, '[path]');
  return s.slice(0, 300);
}

// ── ZIP Validation ─────────────────────────────────

async function loadZipWithGuards(filePath: string, kind: 'docx' | 'xlsx'): Promise<JSZip> {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_OFFICE_FILE_SIZE) {
    throw new Error('File is too large. Maximum size is 20MB.');
  }
  if (stat.size === 0) throw new Error('File is empty.');

  const buffer = await fs.readFile(filePath);

  // Check ZIP magic number before handing to JSZip
  if (!hasZipMagic(buffer)) {
    throw new Error(
      kind === 'docx'
        ? 'This file is not a valid DOCX file.'
        : 'This file is not a valid XLSX file.',
    );
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer, { checkCRC32: true });
  } catch {
    throw new Error(
      kind === 'docx'
        ? 'DOCX preview failed. The file may be corrupted or not a valid DOCX file.'
        : 'XLSX preview failed. The file may be corrupted or not a valid XLSX file.',
    );
  }

  const entries = Object.keys(zip.files);
  if (entries.length > MAX_ZIP_ENTRY_COUNT) {
    throw new Error('Too many entries in the file. May be a zip bomb.');
  }

  let totalExpanded = 0;
  for (const name of entries) {
    const entry = zip.files[name];
    const us = (entry as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    totalExpanded += us;
  }
  if (totalExpanded > MAX_TOTAL_EXPANDED) {
    throw new Error('Expanded size exceeds safety limit.');
  }

  return zip;
}

async function readWhitelistedEntry(
  zip: JSZip,
  entryName: string,
): Promise<string | null> {
  const entry = zip.files[entryName];
  if (!entry) return null;

  const us = (entry as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
  if (us > MAX_SINGLE_XML_EXPANDED) {
    throw new Error(`Entry "${entryName}" is too large when expanded.`);
  }

  return entry.async('string');
}

// ── XML Helpers ────────────────────────────────────

function xmlDecode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ── DOCX Parsing ───────────────────────────────────

export interface DocxParagraph {
  text: string;
  style: 'heading1' | 'heading2' | 'heading3' | 'normal';
}

export interface DocxPreviewResult {
  paragraphs: DocxParagraph[];
  totalParagraphs: number;
  truncated: boolean;
}

export async function readDocxPreview(filePath: string): Promise<DocxPreviewResult> {
  const zip = await loadZipWithGuards(filePath, 'docx');
  const xml = await readWhitelistedEntry(zip, 'word/document.xml');
  if (!xml) return { paragraphs: [], totalParagraphs: 0, truncated: false };

  const paragraphs: DocxParagraph[] = [];
  const pRegex = /<w:p[\s>]([\s\S]*?)<\/w:p\s*>/gi;
  let match: RegExpExecArray | null;

  while ((match = pRegex.exec(xml)) !== null) {
    if (paragraphs.length >= MAX_DOCX_PARAGRAPHS) break;
    const pContent = match[1];

    // Extract style
    let style: DocxParagraph['style'] = 'normal';
    const styleMatch = /<w:pStyle\s[^>]*w:val="([^"]*)"/i.exec(pContent);
    if (styleMatch) {
      const val = styleMatch[1].toLowerCase();
      if (val === 'heading1' || val === '1') style = 'heading1';
      else if (val === 'heading2' || val === '2') style = 'heading2';
      else if (val === 'heading3' || val === '3') style = 'heading3';
    }

    // Extract text from all <w:t> elements
    const textParts: string[] = [];
    const tRegex = /<w:t[\s>]([\s\S]*?)<\/w:t\s*>/gi;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(pContent)) !== null) {
      textParts.push(tMatch[1]);
    }
    // Also try self-closing <w:t/>
    const tSelfRegex = /<w:t\s[^>]*\/>/gi;
    // (self-closing w:t typically has no content, skip)

    const text = xmlDecode(textParts.join('').trim());
    if (text.length > 0) {
      paragraphs.push({ text, style });
    }
  }

  const total = paragraphs.length;
  const truncated = total >= MAX_DOCX_PARAGRAPHS;
  return { paragraphs: paragraphs.slice(0, MAX_DOCX_PARAGRAPHS), totalParagraphs: total, truncated };
}

// ── XLSX Parsing ───────────────────────────────────

export interface XlsxSheetPreview {
  name: string;
  rows: string[][];
  totalRows: number;
  totalColumns: number;
  truncatedRows: boolean;
  truncatedColumns: boolean;
}

export interface XlsxWorkbookPreview {
  sheetNames: string[];
  activeSheetIndex: number;
  activeSheet: XlsxSheetPreview;
}

export async function readXlsxPreview(
  filePath: string,
  sheetIndex = 0,
): Promise<XlsxWorkbookPreview> {
  const zip = await loadZipWithGuards(filePath, 'xlsx');

  // Read workbook.xml for sheet names
  const wbXml = await readWhitelistedEntry(zip, 'xl/workbook.xml');
  const sheetNames: string[] = [];
  if (wbXml) {
    const sheetRegex = /<sheet\s[^>]*name="([^"]*)"[^>]*\/>/gi;
    let sm: RegExpExecArray | null;
    while ((sm = sheetRegex.exec(wbXml)) !== null) {
      if (sheetNames.length >= MAX_XLSX_SHEETS) break;
      sheetNames.push(sm[1]);
    }
  }
  if (sheetNames.length === 0) {
    throw new Error('No sheets found in workbook.');
  }

  const activeIdx = Math.max(0, Math.min(sheetIndex, sheetNames.length - 1));
  const sheetFileName = `xl/worksheets/sheet${activeIdx + 1}.xml`;

  if (!xlsxSheetWhitelisted(sheetFileName)) {
    throw new Error('Sheet not found.');
  }

  // Read shared strings
  const ssXml = await readWhitelistedEntry(zip, 'xl/sharedStrings.xml');
  const sharedStrings = parseSharedStrings(ssXml);

  // Read sheet data
  const sheetXml = await readWhitelistedEntry(zip, sheetFileName);
  const activeSheet = parseSheetXml(sheetXml, sharedStrings, sheetNames[activeIdx]);

  return { sheetNames, activeSheetIndex: activeIdx, activeSheet };
}

// ── Shared Strings ─────────────────────────────────

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  const result: string[] = [];
  const siRegex = /<si>([\s\S]*?)<\/si\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = siRegex.exec(xml)) !== null) {
    const siContent = match[1];
    // Simple text extraction: <t ...>text</t>
    const tMatch = /<t[\s>][\s\S]*?<\/t\s*>/i.exec(siContent);
    if (tMatch) {
      const textContent = /<t[\s>]([\s\S]*?)<\/t\s*>/i.exec(siContent);
      result.push(textContent ? xmlDecode(textContent[1].trim()) : '');
    } else {
      result.push('');
    }
  }
  return result;
}

// ── Sheet XML Parsing ──────────────────────────────

function parseSheetXml(
  xml: string | null,
  sharedStrings: string[],
  sheetName: string,
): XlsxSheetPreview {
  if (!xml) {
    return { name: sheetName, rows: [], totalRows: 0, totalColumns: 0, truncatedRows: false, truncatedColumns: false };
  }

  const colLetters = (n: number): string => {
    let s = '';
    while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
    return s;
  };

  const cellRegex = /<c\s[^>]*r="([A-Z]+)(\d+)"[^>]*>(?:<v>([\s\S]*?)<\/v>)?(?:<is>([\s\S]*?)<\/is>)?[\s\S]*?<\/c\s*>/gi;
  const rowRegex = /<row\s[^>]*r="(\d+)"[\s\S]*?<\/row\s*>/gi;

  // Collect rows
  const rowData = new Map<number, Map<number, string>>();
  let maxCol = 0;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowNum = parseInt(rowMatch[1], 10);
    if (rowNum > MAX_XLSX_ROWS) break;
    const rowContent = rowMatch[0];

    const cells = new Map<number, string>();
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const colLetter = cellMatch[1];
      const colNum = colLetter.split('').reduce((acc, c) => acc * 26 + (c.charCodeAt(0) - 64), 0) - 1;
      if (colNum >= MAX_XLSX_COLS) continue;

      let value = '';
      const vContent = cellMatch[3];  // <v> numeric/shared string index
      const isContent = cellMatch[4]; // <is> inline string

      if (isContent !== undefined) {
        // Inline string
        const tMatch = /<t[\s>]([\s\S]*?)<\/t\s*>/i.exec(isContent);
        value = tMatch ? xmlDecode(tMatch[1].trim()) : '';
      } else if (vContent !== undefined) {
        const numVal = parseFloat(vContent);
        if (!isNaN(numVal) && numVal < sharedStrings.length && numVal >= 0) {
          value = sharedStrings[numVal];
        } else {
          value = vContent;
        }
      }

      cells.set(colNum, value);
      if (colNum > maxCol) maxCol = colNum;
    }
    rowData.set(rowNum, cells);
  }

  // Build ordered rows
  const totalRows = rowData.size;
  const totalColumns = maxCol + 1;
  const truncatedCols = totalColumns > MAX_XLSX_COLS;

  const rows: string[][] = [];
  const sortedRows = [...rowData.keys()].sort((a, b) => a - b);
  for (const rn of sortedRows.slice(0, MAX_XLSX_ROWS)) {
    const cells = rowData.get(rn)!;
    const row: string[] = [];
    for (let c = 0; c < Math.min(totalColumns, MAX_XLSX_COLS); c++) {
      row.push(cells.get(c) ?? '');
    }
    rows.push(row);
  }

  return {
    name: sheetName,
    rows,
    totalRows,
    totalColumns,
    truncatedRows: totalRows > MAX_XLSX_ROWS,
    truncatedColumns: truncatedCols,
  };
}
