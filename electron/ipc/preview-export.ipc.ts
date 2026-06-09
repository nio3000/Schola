/**
 * Preview Export IPC handlers — Phase 4-0-P0-UI-EXPORT.
 *
 * Registers fixed-function IPC channels for exporting Markdown preview
 * as HTML or PDF. renderer sends sanitized HTML + theme CSS; main
 * handles save dialog + file write.
 *
 * Security:
 * 1. Output path chosen by user via save dialog (renderer never specifies).
 * 2. Only sanitized HTML and registered theme CSS accepted.
 * 3. No shell, no generic command, no arbitrary file write.
 * 4. Error messages use safe Chinese text.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  PREVIEW_EXPORT_HTML_CHANNEL,
  PREVIEW_EXPORT_PDF_CHANNEL,
} from '../../src/lib/contracts/import-export-ipc.types';
import type {
  PreviewExportInput,
  PreviewExportResult,
} from '../../src/lib/contracts/preview-export.types';

// ── Input validation ──────────────────────────────

function assertPreviewExportInput(input: unknown): PreviewExportInput {
  if (!input || typeof input !== 'object') {
    throw new Error('INVALID_INPUT');
  }
  const inp = input as Record<string, unknown>;
  if (typeof inp.fileName !== 'string' || inp.fileName.trim().length === 0) {
    throw new Error('INVALID_INPUT');
  }
  if (typeof inp.themeName !== 'string') {
    throw new Error('INVALID_INPUT');
  }
  if (typeof inp.sanitizedHtml !== 'string') {
    throw new Error('INVALID_INPUT');
  }
  if (typeof inp.themeCss !== 'string') {
    throw new Error('INVALID_INPUT');
  }
  return {
    fileName: inp.fileName.trim(),
    themeName: inp.themeName,
    sanitizedHtml: inp.sanitizedHtml,
    themeCss: inp.themeCss,
  };
}

function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 200) || 'export';
}

function buildHtmlDocument(input: PreviewExportInput): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(input.fileName)}</title>
  <meta name="generator" content="Schola Preview Export">
  <meta name="theme" content="${escapeHtml(input.themeName)}">
  <style>
    /* Schola preview export — base reset + print styles */
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; padding: 20px 28px; }
    @media print { body { padding: 0; } }
    /* Theme CSS (self-contained) */
    ${input.themeCss}
    /* ═════════════════════════════════════════════
       Print table overrides — Phase 4-0-P0-UI-EXPORT-R2
       Fix PDF table clipping by removing screen-oriented
       min-width, nowrap, and overflow constraints.
       ═════════════════════════════════════════════ */
    @media print {
      .schola-markdown-preview {
        overflow-x: visible !important;
      }
      .schola-markdown-preview table {
        min-width: 0 !important;
        width: 100% !important;
        table-layout: auto !important;
        word-break: break-word;
      }
      .schola-markdown-preview th,
      .schola-markdown-preview td {
        padding: 4px 6px !important;
      }
      .schola-markdown-preview th {
        white-space: normal !important;
        word-break: break-word;
      }
    }
  </style>
</head>
<body>
  <article class="schola-markdown-preview" data-preview-theme="${escapeHtml(input.themeName)}">
    ${input.sanitizedHtml}
  </article>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Registration ──────────────────────────────────

export function registerPreviewExportIpc(): void {
  // ── preview:export-html ──────────────────────
  ipcMain.handle(
    PREVIEW_EXPORT_HTML_CHANNEL,
    async (_event, rawInput: unknown): Promise<PreviewExportResult> => {
      try {
        const input = assertPreviewExportInput(rawInput);
        const name = safeFileName(input.fileName);

        const window = BrowserWindow.getFocusedWindow();
        if (!window) {
          return { ok: false, error: '无法打开保存对话框。' };
        }

        const result = await dialog.showSaveDialog(window, {
          title: '导出为 HTML',
          defaultPath: name + '.html',
          filters: [{ name: 'HTML Files', extensions: ['html'] }],
        });

        if (result.canceled || !result.filePath) {
          return { ok: false, error: '已取消导出。' };
        }

        const html = buildHtmlDocument(input);
        await fs.writeFile(result.filePath, html, 'utf-8');

        return { ok: true, relativePath: path.basename(result.filePath) };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message === 'INVALID_INPUT') {
          return { ok: false, error: '导出数据无效。' };
        }
        return { ok: false, error: '导出 HTML 失败，请重试。' };
      }
    },
  );

  // ── preview:export-pdf ──────────────────────
  ipcMain.handle(
    PREVIEW_EXPORT_PDF_CHANNEL,
    async (_event, rawInput: unknown): Promise<PreviewExportResult> => {
      let exportWindow: BrowserWindow | null = null;
      try {
        const input = assertPreviewExportInput(rawInput);
        const name = safeFileName(input.fileName);

        const parentWindow = BrowserWindow.getFocusedWindow();
        if (!parentWindow) {
          return { ok: false, error: '无法打开保存对话框。' };
        }

        const result = await dialog.showSaveDialog(parentWindow, {
          title: '导出为 PDF',
          defaultPath: name + '.pdf',
          filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
        });

        if (result.canceled || !result.filePath) {
          return { ok: false, error: '已取消导出。' };
        }

        const html = buildHtmlDocument(input);

        // Create offscreen export window (hidden)
        exportWindow = new BrowserWindow({
          width: 800,
          height: 600,
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
        });

        await exportWindow.loadURL(
          'data:text/html;charset=utf-8,' + encodeURIComponent(html),
        );

        // Wait for rendering
        await new Promise<void>((resolve) => {
          if (!exportWindow) { resolve(); return; }
          exportWindow.webContents.on('did-finish-load', () => resolve());
          setTimeout(resolve, 3000); // fallback timeout
        });

        const pdfBuffer = await exportWindow.webContents.printToPDF({
          pageSize: 'A4',
          printBackground: true,
          margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
          landscape: false,
        });

        await fs.writeFile(result.filePath, pdfBuffer);

        return { ok: true, relativePath: path.basename(result.filePath) };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message === 'INVALID_INPUT') {
          return { ok: false, error: '导出数据无效。' };
        }
        return { ok: false, error: '导出 PDF 失败，请重试。' };
      } finally {
        if (exportWindow && !exportWindow.isDestroyed()) {
          exportWindow.close();
        }
      }
    },
  );
}
