/**
 * Resource read IPC handlers — Phase 5-4A-IMP-3 + IMP-4.
 * PDF: max 50MB, .pdf only. HTML: max 5MB, .html/.htm only.
 * All paths validated via resolveVaultPath. Errors sanitized.
 */
import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RESOURCE_READ_PDF_CHANNEL,
  RESOURCE_READ_HTML_CHANNEL,
  RESOURCE_READ_TEXT_PREVIEW_CHANNEL,
  RESOURCE_READ_DOCX_PREVIEW_CHANNEL,
  RESOURCE_READ_XLSX_PREVIEW_CHANNEL,
  RESOURCE_READ_XLS_PREVIEW_CHANNEL,
  RESOURCE_READ_DOC_PREVIEW_CHANNEL,
} from '../../src/lib/contracts/import-export-ipc.types';
import type {
  ReadPdfResourceInput,
  ReadPdfResourceResult,
  ReadHtmlResourceInput,
  ReadHtmlResourceResult,
  ReadTextPreviewInput,
  ReadTextPreviewResult,
  ReadDocxPreviewInput,
  ReadDocxPreviewResult,
  ReadXlsxPreviewInput,
  ReadXlsxPreviewResult,
  ReadXlsPreviewInput,
  ReadXlsPreviewResult,
  ReadDocPreviewInput,
  ReadDocPreviewResult,
} from '../../src/lib/contracts/resource.types';
import { MAX_PDF_READ_SIZE, MAX_HTML_READ_SIZE, MAX_TEXT_READ_SIZE, MAX_DOCX_READ_SIZE, MAX_XLSX_READ_SIZE } from '../../src/lib/contracts/resource.types';
import { resolveVaultPath } from '../security/path-guard';
import { getVaultRootPath } from '../services/vault.service';
import { assertVaultId } from '../lib/ipc-validation';
import { readDocxPreview, readXlsxPreview } from '../services/office-preview.service';
import * as XLSX from 'xlsx';
import WordExtractor from 'word-extractor';

function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  if (msg.includes(':\\') || msg.includes('/home/') || msg.includes('/Users/'))
    return 'Failed to read file.';
  return msg.slice(0, 200);
}

function sanitizeMessage(msg: string): string {
  if (msg.includes(':\\') || msg.includes('/home/') || msg.includes('/Users/'))
    return 'Preview failed.';
  return msg.slice(0, 200);
}

function validateVaultAndPath(vaultId: unknown, relativePath: unknown): { vault: string; root: string; absPath: string } | { error: string } {
  try { const vault = assertVaultId(vaultId); } catch { return { error: 'Invalid vault.' }; }
  const vault = (vaultId as string);
  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) return { error: 'Invalid file path.' };
  const root = getVaultRootPath(vault);
  if (!root) return { error: 'Vault is not open.' };
  try { return { vault, root, absPath: resolveVaultPath(root, relativePath) }; } catch { return { error: 'File path is outside the vault.' }; }
}

export function registerResourceReadIpc(): void {
  // ── PDF ──
  ipcMain.handle(RESOURCE_READ_PDF_CHANNEL, async (_e, input: unknown): Promise<ReadPdfResourceResult> => {
    try {
      const { vaultId, relativePath } = (input as ReadPdfResourceInput) ?? {};
      const v = validateVaultAndPath(vaultId, relativePath);
      if ('error' in v) return { ok: false, error: v.error };
      const ext = path.extname(relativePath as string).toLowerCase();
      if (ext !== '.pdf') return { ok: false, error: 'Only PDF files can be read through this channel.' };
      const stat = await fs.stat(v.absPath);
      if (stat.size > MAX_PDF_READ_SIZE) return { ok: false, error: `PDF file is too large (${Math.round(stat.size/1024/1024)}MB). Maximum size is 50MB.` };
      if (stat.size === 0) return { ok: false, error: 'PDF file is empty.' };
      const buffer = await fs.readFile(v.absPath);
      const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      return { ok: true, bytes, fileName: path.basename(relativePath as string), size: stat.size };
    } catch (err) { return { ok: false, error: sanitizeError(err) }; }
  });

  // ── HTML ──
  ipcMain.handle(RESOURCE_READ_HTML_CHANNEL, async (_e, input: unknown): Promise<ReadHtmlResourceResult> => {
    try {
      const { vaultId, relativePath } = (input as ReadHtmlResourceInput) ?? {};
      const v = validateVaultAndPath(vaultId, relativePath);
      if ('error' in v) return { ok: false, error: v.error };
      const ext = path.extname(relativePath as string).toLowerCase();
      if (ext !== '.html' && ext !== '.htm') return { ok: false, error: 'Only HTML files can be read through this channel.' };
      const stat = await fs.stat(v.absPath);
      if (stat.size > MAX_HTML_READ_SIZE) return { ok: false, error: `HTML file is too large (${Math.round(stat.size/1024/1024)}MB). Maximum size is 5MB.` };
      if (stat.size === 0) return { ok: false, error: 'HTML file is empty.' };
      const html = await fs.readFile(v.absPath, 'utf-8');
      return { ok: true, html, fileName: path.basename(relativePath as string), size: stat.size };
    } catch (err) { return { ok: false, error: sanitizeError(err) }; }
  });

  // ── Text Preview (TXT / CSV) ──
  ipcMain.handle(RESOURCE_READ_TEXT_PREVIEW_CHANNEL, async (_e, input: unknown): Promise<ReadTextPreviewResult> => {
    try {
      const { vaultId, relativePath } = (input as ReadTextPreviewInput) ?? {};
      const v = validateVaultAndPath(vaultId, relativePath);
      if ('error' in v) return { ok: false, error: v.error };
      const ext = path.extname(relativePath as string).toLowerCase();
      if (ext !== '.txt' && ext !== '.csv')
        return { ok: false, error: 'Text preview only supports .txt and .csv files.' };
      const stat = await fs.stat(v.absPath);
      if (stat.size > MAX_TEXT_READ_SIZE)
        return { ok: false, error: 'Text file is too large. Maximum size is 2MB.' };
      if (stat.size === 0)
        return { ok: false, error: 'Text file is empty.' };
      const text = await fs.readFile(v.absPath, 'utf-8');
      const kind = ext === '.csv' ? 'csv' as const : 'txt' as const;
      return { ok: true, text, fileName: path.basename(relativePath as string), size: stat.size, kind };
    } catch (err) { return { ok: false, error: sanitizeError(err) }; }
  });

  // ── DOCX Preview ──
  ipcMain.handle(RESOURCE_READ_DOCX_PREVIEW_CHANNEL, async (_e, input: unknown): Promise<ReadDocxPreviewResult> => {
    try {
      const { vaultId, relativePath } = (input as ReadDocxPreviewInput) ?? {};
      const v = validateVaultAndPath(vaultId, relativePath);
      if ('error' in v) return { ok: false, error: v.error };
      if (path.extname(relativePath as string).toLowerCase() !== '.docx')
        return { ok: false, error: 'Only .docx files can be read through this channel.' };
      const stat = await fs.stat(v.absPath);
      if (stat.size > MAX_DOCX_READ_SIZE)
        return { ok: false, error: 'DOCX file is too large. Maximum size is 20MB.' };
      if (stat.size === 0)
        return { ok: false, error: 'DOCX file is empty.' };
      const result = await readDocxPreview(v.absPath);
      return { ok: true, fileName: path.basename(relativePath as string), relativePath: relativePath as string, size: stat.size, paragraphs: result.paragraphs, truncated: result.truncated, totalParagraphs: result.totalParagraphs };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'DOCX preview failed. The file may be corrupted or not a valid DOCX file.';
      return { ok: false, error: sanitizeMessage(msg) };
    }
  });

  // ── XLSX Preview ──
  ipcMain.handle(RESOURCE_READ_XLSX_PREVIEW_CHANNEL, async (_e, input: unknown): Promise<ReadXlsxPreviewResult> => {
    try {
      const { vaultId, relativePath, sheetIndex } = (input as ReadXlsxPreviewInput) ?? {};
      const v = validateVaultAndPath(vaultId, relativePath);
      if ('error' in v) return { ok: false, error: v.error };
      if (path.extname(relativePath as string).toLowerCase() !== '.xlsx')
        return { ok: false, error: 'Only .xlsx files can be read through this channel.' };
      const stat = await fs.stat(v.absPath);
      if (stat.size > MAX_XLSX_READ_SIZE)
        return { ok: false, error: 'XLSX file is too large. Maximum size is 20MB.' };
      if (stat.size === 0)
        return { ok: false, error: 'XLSX file is empty.' };
      const wb = await readXlsxPreview(v.absPath, typeof sheetIndex === 'number' ? sheetIndex : 0);
      return { ok: true, fileName: path.basename(relativePath as string), relativePath: relativePath as string, size: stat.size, workbook: wb };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'XLSX preview failed. The file may be corrupted or not a valid XLSX file.';
      return { ok: false, error: sanitizeMessage(msg) };
    }
  });

  // ── XLS Preview (Legacy) ──
  ipcMain.handle(RESOURCE_READ_XLS_PREVIEW_CHANNEL, async (_e, input: unknown): Promise<ReadXlsPreviewResult> => {
    try {
      const { vaultId, relativePath, sheetIndex } = (input as ReadXlsPreviewInput) ?? {};
      const v = validateVaultAndPath(vaultId, relativePath);
      if ('error' in v) return { ok: false, error: v.error };
      if (path.extname(relativePath as string).toLowerCase() !== '.xls')
        return { ok: false, error: 'Only .xls files can be read through this channel.' };
      const stat = await fs.stat(v.absPath);
      if (stat.size > MAX_XLSX_READ_SIZE)
        return { ok: false, error: 'XLS file is too large. Maximum size is 20MB.' };
      if (stat.size === 0)
        return { ok: false, error: 'XLS file is empty.' };
      const buffer = await fs.readFile(v.absPath);
      const workbook = XLSX.read(buffer, { type: 'buffer', cellFormula: false, cellHTML: false, cellStyles: false, bookVBA: false, bookFiles: false });
      const sheetNames: string[] = workbook.SheetNames.slice(0, 30);
      if (sheetNames.length === 0) return { ok: false, error: 'No sheets found in file.' };
      const si = typeof sheetIndex === 'number' ? Math.max(0, Math.min(sheetIndex, sheetNames.length - 1)) : 0;
      const sheet = workbook.Sheets[sheetNames[si]];
      const data = XLSX.utils.sheet_to_json<(string|number)[]>(sheet, { header: 1, raw: true, blankrows: false }) as (string|number)[][];
      const rows = data.slice(0, 101); // first row may be header, + 100 data rows
      const totalRows = data.length;
      const totalColumns = rows.reduce((m, r) => Math.max(m, r.length), 0);
      const limitedRows = rows.map(r => r.slice(0, 30).map(c => String(c ?? '')));
      return {
        ok: true,
        fileName: path.basename(relativePath as string),
        relativePath: relativePath as string,
        workbook: {
          sheetNames,
          activeSheet: { name: sheetNames[si], rows: limitedRows, totalRows, totalColumns: Math.min(totalColumns, 30), truncated: totalRows > 101 || totalColumns > 30 },
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'XLS preview failed. The file may be corrupted or not a valid XLS file.';
      return { ok: false, error: sanitizeMessage(msg) };
    }
  });

  // ── DOC Preview (Legacy) ──
  ipcMain.handle(RESOURCE_READ_DOC_PREVIEW_CHANNEL, async (_e, input: unknown): Promise<ReadDocPreviewResult> => {
    try {
      const { vaultId, relativePath } = (input as ReadDocPreviewInput) ?? {};
      const v = validateVaultAndPath(vaultId, relativePath);
      if ('error' in v) return { ok: false, error: v.error };
      if (path.extname(relativePath as string).toLowerCase() !== '.doc')
        return { ok: false, error: 'Only .doc files can be read through this channel.' };
      const stat = await fs.stat(v.absPath);
      if (stat.size > MAX_DOCX_READ_SIZE)
        return { ok: false, error: 'DOC file is too large. Maximum size is 20MB.' };
      if (stat.size === 0)
        return { ok: false, error: 'DOC file is empty.' };
      const buffer = await fs.readFile(v.absPath);
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buffer);
      let text = doc.getBody();
      const MAX_CHARS = 500000;
      const truncated = text.length > MAX_CHARS;
      if (truncated) text = text.slice(0, MAX_CHARS);
      return { ok: true, fileName: path.basename(relativePath as string), relativePath: relativePath as string, text, size: stat.size, truncated };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'DOC preview failed. The file may be corrupted or not a valid DOC file.';
      return { ok: false, error: sanitizeMessage(msg) };
    }
  });
}
