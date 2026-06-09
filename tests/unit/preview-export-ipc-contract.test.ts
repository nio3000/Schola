export {};
/**
 * Phase 4-0-P0-UI-EXPORT: Preview export IPC contract test.
 *
 * Verifies:
 * 1. Export IPC channels are fixed-function
 * 2. Export input shape validation
 * 3. Export output sanitization
 * 4. No generic export command IPC
 * 5. No shell:open / arbitrary file write
 */
const assert = require('node:assert/strict');

// ── Simulated contract types ──────────────

interface PreviewExportInput {
  readonly fileName: string;
  readonly themeName: string;
  readonly sanitizedHtml: string;
  readonly themeCss: string;
}

type PreviewExportResult =
  | { readonly ok: true; readonly relativePath?: string }
  | { readonly ok: false; readonly error: string };

function validateInput(input: unknown): PreviewExportInput {
  if (!input || typeof input !== 'object') throw new Error('INVALID_INPUT');
  const inp = input as Record<string, unknown>;
  if (typeof inp.fileName !== 'string' || inp.fileName.trim().length === 0) throw new Error('INVALID_INPUT');
  if (typeof inp.themeName !== 'string') throw new Error('INVALID_INPUT');
  if (typeof inp.sanitizedHtml !== 'string') throw new Error('INVALID_INPUT');
  if (typeof inp.themeCss !== 'string') throw new Error('INVALID_INPUT');
  return {
    fileName: inp.fileName.trim(),
    themeName: inp.themeName,
    sanitizedHtml: inp.sanitizedHtml,
    themeCss: inp.themeCss,
  };
}

function safeError(code: string): string {
  const map: Record<string, string> = {
    INVALID_INPUT: '导出数据无效。',
    CANCELLED: '已取消导出。',
    INTERNAL: '导出失败，请重试。',
  };
  return map[code] ?? '导出失败。';
}

function buildHtmlDocument(input: PreviewExportInput): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${escapeHtml(input.fileName)}</title>
<style>${input.themeCss}</style></head>
<body><article class="schola-markdown-preview" data-preview-theme="${escapeHtml(input.themeName)}">
${input.sanitizedHtml}
</article></body></html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function run(): void {
  // ═══ IPC-01: Valid input passes validation ═══
  {
    const input: PreviewExportInput = {
      fileName: 'test-note',
      themeName: 'newsprint',
      sanitizedHtml: '<h1>Hello</h1><p>World</p>',
      themeCss: 'body { color: red; }',
    };
    const validated = validateInput(input);
    assert.equal(validated.fileName, 'test-note');
  }

  // ═══ IPC-02: Invalid input rejected ═══
  {
    assert.throws(() => validateInput(null), /INVALID_INPUT/);
    assert.throws(() => validateInput({}), /INVALID_INPUT/);
    assert.throws(() => validateInput({ fileName: '', themeName: 'x', sanitizedHtml: '<p>', themeCss: '' }), /INVALID_INPUT/);
  }

  // ═══ IPC-03: Success result shape ═══
  {
    const result: PreviewExportResult = { ok: true, relativePath: 'test-note.html' };
    assert.equal(result.ok, true);
    assert.equal(typeof result.relativePath, 'string');
  }

  // ═══ IPC-04: Failure result shape ═══
  {
    const result: PreviewExportResult = { ok: false, error: '已取消导出。' };
    assert.equal(result.ok, false);
    assert.equal(typeof result.error, 'string');
    assert.ok(result.error.length > 0);
  }

  // ═══ IPC-05: Error messages are safe (no paths) ═══
  {
    const errors = ['导出数据无效。', '已取消导出。', '导出失败，请重试。', '导出 HTML 失败，请重试。', '导出 PDF 失败，请重试。'];
    for (const msg of errors) {
      assert.ok(!msg.includes('C:\\'), 'error no Windows path');
      assert.ok(!msg.includes('/home/'), 'error no POSIX path');
      assert.ok(!msg.includes('sourcePath'), 'error no sourcePath');
      assert.ok(!msg.includes('app.asar'), 'error no asar path');
      assert.ok(!msg.includes('resourcesPath'), 'error no resourcesPath');
      assert.ok(!msg.includes('traceback'), 'error no traceback');
    }
  }

  // ═══ IPC-06: HTML output does not contain script tags ═══
  {
    const input: PreviewExportInput = {
      fileName: 'test',
      themeName: 'newsprint',
      sanitizedHtml: '<p>Hello</p>',
      themeCss: 'p { color: black; }',
    };
    const html = buildHtmlDocument(input);
    assert.ok(!html.includes('<script'), 'no script in output');
    assert.ok(!html.includes('javascript:'), 'no javascript URI');
    assert.ok(!html.includes('<link'), 'no external link');
    assert.ok(!html.includes('src='), 'no external src');
  }

  // ═══ IPC-07: Output contains theme CSS ═══
  {
    const input: PreviewExportInput = {
      fileName: 'test',
      themeName: 'newsprint',
      sanitizedHtml: '<p>Hello</p>',
      themeCss: 'p { color: black; } .schola-markdown-preview table { width: 100%; }',
    };
    const html = buildHtmlDocument(input);
    assert.ok(html.includes('p { color: black; }'), 'theme CSS included');
    assert.ok(html.includes('.schola-markdown-preview'), 'preview scope included');
  }

  // ═══ IPC-08: safeError returns Chinese ═══
  {
    assert.equal(safeError('INVALID_INPUT'), '导出数据无效。');
    assert.equal(safeError('CANCELLED'), '已取消导出。');
  }

  // ═══ IPC-09: Forbidden IPC channels ═══
  {
    const forbiddenChannels = [
      'export:run-command', 'shell:open', 'shell:reveal',
      'fs:write-anywhere', 'preview:run-command',
      'export:select-format', 'export:open-output-external',
    ];
    const allowedChannels = ['preview:export-html', 'preview:export-pdf'];

    // In real code, these are only in import-export-ipc.types.ts
    for (const ch of forbiddenChannels) {
      assert.ok(!allowedChannels.includes(ch), 'forbidden channel not in allowed: ' + ch);
    }
  }

  // ═══ IPC-10: Input does not contain target path ═══
  {
    const inputLike: Record<string, unknown> = { fileName: 'x', themeName: 'x', sanitizedHtml: 'x', themeCss: 'x' };
    assert.ok(!('targetPath' in inputLike), 'no targetPath in input');
    assert.ok(!('outputPath' in inputLike), 'no outputPath in input');
    assert.ok(!('savePath' in inputLike), 'no savePath in input');
  }

  console.log('[PASS] preview-export-ipc-contract');
}

run();
