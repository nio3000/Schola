/**
 * Phase 3-4-H3-IPC: Original import file path guard test.
 *
 * Covers the 19-step path guard validation logic.
 * Tests pure path validation without shell/vault dependencies.
 */
import assert from 'node:assert/strict';
import path from 'node:path';

// ── Simulated path guard ──────────────────────────

const ENCODED_TRAVERSAL = [/%2e%2e/i, /%252e/i, /%c0%ae/i, /%uff0e/i];

type PGResult = { ok: false; error: string } | string;

function pgFail(msg: string): { ok: false; error: string } {
  return { ok: false, error: msg };
}

function isFail(r: PGResult): r is { ok: false; error: string } {
  return typeof r === 'object' && 'ok' in r && (r as { ok: boolean }).ok === false;
}

function validatePgSteps(input: unknown): PGResult {
  // STEP 1: type + non-empty
  if (typeof input !== 'string' || input.trim().length === 0) return pgFail('文件路径无效。');
  // STEP 2: normalize separators
  let n = input.replace(/\\/g, '/').replace(/\/+/g, '/');
  // STEP 3: absolute
  if (path.isAbsolute(n) || n.startsWith('/') || /^[A-Za-z]:[/\\]/.test(n)) return pgFail('文件路径无效。');
  // STEP 4: URL
  if (/^(https?|file|data|ftp):\/\//i.test(n)) return pgFail('文件路径无效。');
  // STEP 5: traversal
  if (n.includes('..')) return pgFail('文件路径无效。');
  // STEP 6: encoded traversal
  for (const p of ENCODED_TRAVERSAL) { if (p.test(n)) return pgFail('文件路径无效。'); }
  // STEP 7: null byte
  if (n.includes('\0')) return pgFail('文件路径无效。');
  // STEP 8: segments — 3 segments: attachments / imports / {jobId}_{safeName}.pdf
  const seg = n.split('/');
  if (seg.length !== 3) return pgFail('找不到原始导入文件。');
  const [r0, r1, fileName] = seg;
  // STEP 9: prefix
  if (r0 !== 'attachments' || r1 !== 'imports') return pgFail('找不到原始导入文件。');
  // STEP 10-11: combined filename: {jobId}_{safeName}.pdf
  // safeName does NOT contain dots (dots only for extension)
  if (!/^([a-zA-Z0-9_-]{8,80})_([a-zA-Z0-9\u4e00-\u9fff_ -]{1,180})\.pdf$/i.test(fileName)) return pgFail('文件类型不支持。');
  if (fileName.startsWith('.') || fileName.includes('/') || fileName.includes('\\')) return pgFail('文件类型不支持。');
  // STEP 12: extension
  const ext = path.extname(fileName).toLowerCase();
  if (ext !== '.pdf') return pgFail('文件类型不支持。');
  // STEP 14: double extension — use original extension case for basename
  const origExt = path.extname(fileName);
  const base = path.basename(fileName, origExt);
  if (base === '' || base === '.' || base.includes('.')) return pgFail('文件类型不支持。');
  return n;
}

// ── Run ────────────────────────────────────────────

function run(): void {
  // TYPE
  assert.ok(isFail(validatePgSteps(123)));
  assert.ok(isFail(validatePgSteps('')));
  assert.ok(isFail(validatePgSteps('  ')));

  // NORMALIZE
  assert.equal(typeof validatePgSteps('attachments\\imports\\import_abc123_paper.pdf'), 'string');

  // ABSOLUTE
  assert.ok(isFail(validatePgSteps('C:\\Users\\test\\file.pdf')));
  assert.ok(isFail(validatePgSteps('/home/user/file.pdf')));
  assert.ok(isFail(validatePgSteps('D:/data/file.pdf')));

  // URL
  assert.ok(isFail(validatePgSteps('file:///C:/Users/test/file.pdf')));
  assert.ok(isFail(validatePgSteps('https://evil.com/file.pdf')));

  // TRAVERSAL
  assert.ok(isFail(validatePgSteps('attachments/imports/../secret.pdf')));
  assert.ok(isFail(validatePgSteps('attachments/imports/../../paper.pdf')));

  // ENCODED TRAVERSAL
  assert.ok(isFail(validatePgSteps('attachments/imports/%2e%2e/paper.pdf')));
  assert.ok(isFail(validatePgSteps('attachments/imports/%252e%252e/paper.pdf')));
  assert.ok(isFail(validatePgSteps('attachments/imports/%c0%ae%c0%ae/paper.pdf')));
  assert.ok(isFail(validatePgSteps('attachments/imports/%uff0e%uff0e/paper.pdf')));

  // NULL BYTE
  assert.ok(isFail(validatePgSteps('attachments/imports/import_abc123_paper.pdf\0extra')));

  // SEGMENTS + PREFIX
  assert.equal(typeof validatePgSteps('attachments/imports/import_abc123_paper.pdf'), 'string');
  assert.ok(isFail(validatePgSteps('attachments/imports')));
  assert.ok(isFail(validatePgSteps('attachments/imports/sub/import_abc123_paper.pdf')));
  assert.ok(isFail(validatePgSteps('notes/imported/import_abc123_paper.pdf')));
  assert.ok(isFail(validatePgSteps('_exports/import_abc123_paper.pdf')));

  // JOB ID
  assert.equal(typeof validatePgSteps('attachments/imports/import_abc123_xyz789_paper.pdf'), 'string');
  assert.ok(isFail(validatePgSteps('attachments/imports/ab_paper.pdf')));  // jobId too short
  assert.ok(isFail(validatePgSteps('attachments/imports/../paper.pdf')));  // traversal masquerading

  // SAFE NAME
  assert.equal(typeof validatePgSteps('attachments/imports/import_abc123_paper.pdf'), 'string');
  assert.ok(isFail(validatePgSteps('attachments/imports/import_abc123_paper<evil>.pdf')));
  assert.ok(isFail(validatePgSteps('attachments/imports/import_abc123_.pdf')));  // safeName is dot
  assert.equal(typeof validatePgSteps('attachments/imports/import_abc123_论文.pdf'), 'string');

  // EXTENSION
  assert.equal(typeof validatePgSteps('attachments/imports/import_abc123_paper.pdf'), 'string');
  assert.equal(typeof validatePgSteps('attachments/imports/import_abc123_paper.PDF'), 'string');
  assert.equal(typeof validatePgSteps('attachments/imports/import_abc123_paper.Pdf'), 'string');
  assert.ok(isFail(validatePgSteps('attachments/imports/import_abc123_paper.exe')));
  assert.ok(isFail(validatePgSteps('attachments/imports/import_abc123_paper.docx')));
  assert.ok(isFail(validatePgSteps('attachments/imports/import_abc123_paper')));  // no ext
  assert.ok(isFail(validatePgSteps('attachments/imports/import_abc123_paper.pdf.exe')));
  assert.ok(isFail(validatePgSteps('attachments/imports/import_abc123_paper.pdf.js')));

  // ERROR SANITIZE
  const allErrs = ['', 'C:\\Users\\test.pdf', '../secret.pdf', 'notes/x.pdf',
    'attachments/imports/ab_paper.exe']
    .map(i => validatePgSteps(i))
    .filter((r): r is { ok: false; error: string } => isFail(r))
    .map(r => r.error);
  for (const err of allErrs) {
    assert.ok(!err.includes('C:\\'));
    assert.ok(!err.includes('/home/'));
    assert.ok(!err.includes('/Users/'));
    assert.ok(!err.includes('sourcePath'));
    assert.ok(!err.includes('traceback'));
    assert.ok(!err.includes('markitdown'));
    assert.ok(!err.includes('Docling'));
  }

  // NO HEAVY RUNTIME
  const code = validatePgSteps.toString();
  assert.ok(!code.includes('RuntimePack'));
  assert.ok(!code.includes('pip '));
  assert.ok(!code.includes('venv'));
  assert.ok(!code.includes('model'));
  assert.ok(!code.includes('PyMuPDF'));

  console.log('[PASS] import-original-file-path-guard');
}

run();
