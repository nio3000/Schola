/**
 * R6-R14: Styled HTML export tests.
 * Verifies export includes theme CSS and uses fixed-function IPC channels.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

function readSrc(p: string): string { return readFileSync(resolve(ROOT, p), 'utf8'); }

describe('Styled HTML export (R6-R14)', () => {
  const ppSrc = readSrc('src/features/preview/PreviewPanel.tsx');
  const apiSrc = readSrc('src/lib/platform/schola-api.ts');
  const ipcSrc = readSrc('src/lib/contracts/import-export-ipc.types.ts');

  it('PreviewPanel has getThemeCss function', () => {
    expect(ppSrc).toContain('getThemeCss');
    expect(ppSrc).toContain('document.styleSheets');
  });

  it('getThemeCss collects CSS from stylesheets', () => {
    expect(ppSrc).toContain('sheet.cssRules');
    expect(ppSrc).toContain('CSSStyleRule');
  });

  it('getThemeCss filters for schola-markdown-preview selectors', () => {
    expect(ppSrc).toContain('schola-markdown-preview');
    expect(ppSrc).toContain('preview-theme');
  });

  it('HTML export passes themeCss to previewExportHtml', () => {
    expect(ppSrc).toContain('previewExportHtml');
    expect(ppSrc).toContain('themeCss');
    expect(ppSrc).toContain('themeName');
  });

  it('PDF export passes themeCss to previewExportPdf', () => {
    expect(ppSrc).toContain('previewExportPdf');
    expect(ppSrc).toContain('themeCss');
  });

  it('uses fixed-function preview:export-html channel', () => {
    expect(ipcSrc).toContain('PREVIEW_EXPORT_HTML_CHANNEL');
    expect(ipcSrc).toContain("'preview:export-html'");
  });

  it('uses fixed-function preview:export-pdf channel', () => {
    expect(ipcSrc).toContain('PREVIEW_EXPORT_PDF_CHANNEL');
    expect(ipcSrc).toContain("'preview:export-pdf'");
  });

  it('no generic export IPC channels added (only fixed-function channels)', () => {
    // Verify only allowed channels are defined as actual exports
    expect(ipcSrc).toContain("export const EXPORT_CREATE_JOB_CHANNEL");
    expect(ipcSrc).toContain("export const EXPORT_GET_JOB_STATUS_CHANNEL");
    expect(ipcSrc).toContain("export const EXPORT_LIST_JOBS_CHANNEL");
    expect(ipcSrc).toContain("export const EXPORT_CANCEL_JOB_CHANNEL");
    // Verify no generic channel constants defined
    expect(ipcSrc).not.toContain("export const EXPORT_RUN_");
    expect(ipcSrc).not.toContain("export const EXPORT_SET_");
    expect(ipcSrc).not.toContain("export const EXPORT_SELECT_FORMAT");
  });

  it('schola-api.ts exports previewExportHtml function', () => {
    expect(apiSrc).toMatch(/export\s+async\s+function\s+previewExportHtml/);
    expect(apiSrc).toContain('getPreviewExport().exportHtml');
  });

  it('schola-api.ts exports previewExportPdf function', () => {
    expect(apiSrc).toMatch(/export\s+async\s+function\s+previewExportPdf/);
    expect(apiSrc).toContain('getPreviewExport().exportPdf');
  });
});
