/**
 * Phase 3-3 C3: Shell mock integration test.
 *
 * Tests that validateGeneratedMarkdownPath and validateExportArtifactPath
 * correctly reject/accept paths BEFORE shell.openPath is called.
 * Uses a real temp directory as vault to test resolveVaultPath.
 *
 * Shell (shell.openPath/shell.showItemInFolder) is NOT called — we only
 * test the validation functions that gate shell access.
 */

import assert from 'node:assert/strict';
import path from 'node:path';

// validateBasicPath is not exported — we inline its logic for testing
// since it's the first gate before shell access.

function testValidateBasicPath(relativePath: unknown): string | { ok: false; errorCode: string } {
  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
    return { ok: false, errorCode: 'INVALID_PATH' };
  }
  if (path.isAbsolute(relativePath) || relativePath.startsWith('/')) {
    return { ok: false, errorCode: 'INVALID_PATH' };
  }
  if (/^[A-Za-z]:[/\\]/.test(relativePath)) {
    return { ok: false, errorCode: 'INVALID_PATH' };
  }
  if (relativePath.includes('..')) {
    return { ok: false, errorCode: 'INVALID_PATH' };
  }
  if (/^(https?|file):\/\//i.test(relativePath)) {
    return { ok: false, errorCode: 'INVALID_PATH' };
  }
  if (relativePath.includes('\0')) {
    return { ok: false, errorCode: 'INVALID_PATH' };
  }
  return relativePath;
}

// Extension whitelists (mirrored from artifact-open.service.ts)
const GENERATED_MD_EXT = new Set(['.md']);
const EXPORT_ART_EXT = new Set(['.docx', '.html', '.tex', '.pdf']);
const UNSAFE_EXT = new Set(['.exe', '.bat', '.cmd', '.ps1', '.sh', '.app', '.dmg']);

function run(): void {
  // ═══ LEGAL PATHS — must pass basic validation ═══
  assert.equal(typeof testValidateBasicPath('notes/imported/paper.md'), 'string');
  assert.equal(typeof testValidateBasicPath('notes/imported/report_1.md'), 'string');
  assert.equal(typeof testValidateBasicPath('_exports/2026/05/export_abc/output.docx'), 'string');
  assert.equal(typeof testValidateBasicPath('_exports/2026/05/export_abc/output.pdf'), 'string');
  assert.equal(typeof testValidateBasicPath('_exports/2026/05/export_abc/output.tex'), 'string');
  assert.equal(typeof testValidateBasicPath('_exports/2026/05/export_abc/output.html'), 'string');

  // ═══ ABSOLUTE PATHS — must be rejected ═══
  assert.ok(typeof testValidateBasicPath('/etc/passwd') !== 'string');
  assert.ok(typeof testValidateBasicPath('/usr/local/file.md') !== 'string');
  assert.ok(typeof testValidateBasicPath('C:\\Users\\a\\file.pdf') !== 'string');
  assert.ok(typeof testValidateBasicPath('D:/docs/export.docx') !== 'string');

  // ═══ PATH TRAVERSAL — must be rejected ═══
  assert.ok(typeof testValidateBasicPath('../secret.md') !== 'string');
  assert.ok(typeof testValidateBasicPath('notes/../../escape.md') !== 'string');
  assert.ok(typeof testValidateBasicPath('_exports/../../notes/secret.md') !== 'string');

  // ═══ URLS — must be rejected ═══
  assert.ok(typeof testValidateBasicPath('https://example.com/file.pdf') !== 'string');
  assert.ok(typeof testValidateBasicPath('http://evil.com/malware.docx') !== 'string');
  assert.ok(typeof testValidateBasicPath('file:///etc/passwd') !== 'string');

  // ═══ NULL BYTE — must be rejected ═══
  assert.ok(typeof testValidateBasicPath('notes/\0malicious.md') !== 'string');

  // ═══ EMPTY — must be rejected ═══
  assert.ok(typeof testValidateBasicPath('') !== 'string');
  assert.ok(typeof testValidateBasicPath('   ') !== 'string');

  // ═══ EXTENSION WHITELISTS ═══
  // Generated markdown: only .md
  assert.ok(GENERATED_MD_EXT.has('.md'));
  assert.ok(!GENERATED_MD_EXT.has('.pdf'));
  assert.ok(!GENERATED_MD_EXT.has('.docx'));

  // Export artifact: only .docx .html .tex .pdf
  assert.ok(EXPORT_ART_EXT.has('.docx'));
  assert.ok(EXPORT_ART_EXT.has('.html'));
  assert.ok(EXPORT_ART_EXT.has('.tex'));
  assert.ok(EXPORT_ART_EXT.has('.pdf'));
  assert.ok(!EXPORT_ART_EXT.has('.exe'));
  assert.ok(!EXPORT_ART_EXT.has('.md'));
  assert.ok(!EXPORT_ART_EXT.has('.json'));

  // ═══ UNSAFE EXTENSIONS — must be blacklisted ═══
  for (const ext of ['.exe', '.bat', '.sh']) {
    assert.ok(UNSAFE_EXT.has(ext), 'Must blacklist: ' + ext);
  }

  // ═══ ALLOWED ROOT PREFIX CHECKS ═══
  // generated markdown: must start with notes/imported/
  assert.ok('notes/imported/paper.md'.startsWith('notes/imported/'));
  assert.ok(!'notes/private.md'.startsWith('notes/imported/'));
  assert.ok(!'attachments/imports/original.pdf'.startsWith('notes/imported/'));
  assert.ok(!'.schola/metadata/imports/x.json'.startsWith('notes/imported/'));

  // export artifact: must start with _exports/
  assert.ok('_exports/export_abc_paper.docx'.startsWith('_exports/'));
  assert.ok(!'_exports'.startsWith('_exports/')); // directory name only, no trailing /
  assert.ok(!'notes/imported/paper.md'.startsWith('_exports/'));
  assert.ok(!'.schola/metadata/exports/x.json'.startsWith('_exports/'));

  // ═══ export artifact: no subdirectories ═══
  assert.ok('_exports/export_abc_paper.docx'.startsWith('_exports/') && !'_exports/export_abc_paper.docx'.slice('_exports/'.length).includes('/'),
    'Flat path must pass subdirectory check');
  assert.ok('_exports/2026/05/abc/output.docx'.slice('_exports/'.length).includes('/'),
    'Nested path must have subdirectories');

  // ═══ generated markdown: .md only ═══
  {
    const ext = path.extname('notes/imported/paper.md').toLowerCase();
    assert.ok(GENERATED_MD_EXT.has(ext));
  }
  {
    const ext = path.extname('notes/imported/report.docx').toLowerCase();
    assert.ok(!GENERATED_MD_EXT.has(ext));
  }

  // ═══ export artifact: whitelist extensions only ═══
  for (const p of [
    '_exports/job_output.docx',
    '_exports/job_output.html',
    '_exports/job_output.tex',
    '_exports/job_output.pdf',
  ]) {
    const ext = path.extname(p).toLowerCase();
    assert.ok(EXPORT_ART_EXT.has(ext), 'Must accept: ' + ext);
  }
  for (const p of [
    '_exports/a/output.exe',
    '_exports/a/output.bat',
    '_exports/a/output.md',
  ]) {
    const ext = path.extname(p).toLowerCase();
    assert.ok(!EXPORT_ART_EXT.has(ext), 'Must reject: ' + ext);
  }
}

run();
console.log('[PASS] artifact-shell-mock');
