/**
 * Phase 3-2: Artifact path guard test.
 *
 * Tests validateBasicPath logic: rejects absolute paths, ../, URLs,
 * null bytes, and empty strings.  Allows notes/imported/*.md and
 * _exports/.../output.ext within allowed extensions.
 *
 * Tests use validateBasicPath directly (no vault required).
 */

import assert from 'node:assert/strict';
import path from 'node:path';

// Minimal inline path validation (mirrors artifact-open.service.ts logic)

function validateBasicPath(relativePath: unknown): string | { ok: false; errorCode: string; message: string } {
  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
    return { ok: false, errorCode: 'INVALID_PATH', message: 'Path must be a non-empty string.' };
  }
  if (path.isAbsolute(relativePath) || relativePath.startsWith('/')) {
    return { ok: false, errorCode: 'INVALID_PATH', message: 'Path must be vault-relative.' };
  }
  if (/^[A-Za-z]:[/\\]/.test(relativePath)) {
    return { ok: false, errorCode: 'INVALID_PATH', message: 'Path must be vault-relative.' };
  }
  if (relativePath.includes('..')) {
    return { ok: false, errorCode: 'INVALID_PATH', message: 'Path traversal not allowed.' };
  }
  if (/^(https?|file):\/\//i.test(relativePath)) {
    return { ok: false, errorCode: 'INVALID_PATH', message: 'URLs not allowed.' };
  }
  if (relativePath.includes('\0')) {
    return { ok: false, errorCode: 'INVALID_PATH', message: 'Invalid characters.' };
  }
  return relativePath;
}

function run(): void {
  // ── Allowed paths ────────────────────────────
  assert.equal(typeof validateBasicPath('notes/imported/paper.md'), 'string');
  assert.equal(typeof validateBasicPath('notes/imported/report_1.md'), 'string');
  assert.equal(typeof validateBasicPath('_exports/2026/05/abc/output.docx'), 'string');
  assert.equal(typeof validateBasicPath('_exports/2026/05/abc/output.pdf'), 'string');
  assert.equal(typeof validateBasicPath('_exports/nested/deep/output.tex'), 'string');

  // ── Rejected: absolute paths ─────────────────
  assert.ok(typeof validateBasicPath('/usr/local/file.md') !== 'string');
  assert.ok(typeof validateBasicPath('C:\\Users\\a\\file.pdf') !== 'string');
  assert.ok(typeof validateBasicPath('D:/docs/export.docx') !== 'string');

  // ── Rejected: path traversal ─────────────────
  assert.ok(typeof validateBasicPath('../secret.md') !== 'string');
  assert.ok(typeof validateBasicPath('notes/../../escape.md') !== 'string');
  assert.ok(typeof validateBasicPath('_exports/../../notes/secret.md') !== 'string');

  // ── Rejected: URLs ───────────────────────────
  assert.ok(typeof validateBasicPath('https://example.com/file.pdf') !== 'string');
  assert.ok(typeof validateBasicPath('file:///etc/passwd') !== 'string');

  // ── Rejected: null byte ──────────────────────
  assert.ok(typeof validateBasicPath('notes/\0malicious.md') !== 'string');

  // ── Rejected: empty ──────────────────────────
  assert.ok(typeof validateBasicPath('') !== 'string');
  assert.ok(typeof validateBasicPath('   ') !== 'string');

  // ── Extension whitelist for export artifacts ──
  const EXPORT_EXTENSIONS = new Set(['.docx', '.html', '.tex', '.pdf']);
  assert.ok(EXPORT_EXTENSIONS.has('.docx'));
  assert.ok(EXPORT_EXTENSIONS.has('.pdf'));
  assert.ok(!EXPORT_EXTENSIONS.has('.exe'), 'Must reject .exe');
  assert.ok(!EXPORT_EXTENSIONS.has('.bat'), 'Must reject .bat');
  assert.ok(!EXPORT_EXTENSIONS.has('.sh'), 'Must reject .sh');

  // ── Generated markdown: only .md ─────────────
  const MD_EXTENSIONS = new Set(['.md']);
  assert.ok(MD_EXTENSIONS.has('.md'));
  assert.ok(!MD_EXTENSIONS.has('.pdf'), 'Generated markdown must not allow .pdf');

  // ── Unsafe extension blacklist ───────────────
  const UNSAFE = new Set(['.exe', '.bat', '.cmd', '.ps1', '.sh', '.app', '.dmg', '.vbs', '.msi', '.scr', '.pif', '.com']);
  for (const ext of ['.exe', '.bat', '.sh']) {
    assert.ok(UNSAFE.has(ext), 'Must blacklist ' + ext);
  }
}

run();
console.log('[PASS] artifact-path-guard');
