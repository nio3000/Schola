/**
 * @legacy CODE-QUALITY-IMP-4: Docling archived.
 *
 * Phase 3-4-D-R5-P1: Docling engine error sanitization test.
 *
 * Validates that engine error output from docling.engine.ts:
 *   1. Bridge ok=false → error sanitized (no paths, tracebacks, engine names)
 *   2. Output empty → failed (not completed)
 *   3. Invalid JSON → failed with safe message
 *   4. Error messages never leak Python / Docling / traceback / stderr / paths
 *   5. Safe Chinese messages pass through unchanged
 */
import assert from 'node:assert/strict';
import {
  sanitizeErrorMessage,
  validateBridgeOutput,
  isBareFilename,
  FORBIDDEN_UI_TERMS,
} from '../../electron/services/engines/import/bridge-validation.ts';

function run(): void {
  // ═══ 1: bridge ok=false → error sanitized ═══
  const leakyErrors: [string, string][] = [
    ['Docling Traceback at C:\\site-packages\\docling\\conv.py:42', 'Windows path + engine + traceback'],
    ['Python stderr: /home/user/pdfminer error', 'Linux path + Python + stderr'],
    ['pypdfium2 render failure at stderr output /usr/local/', 'dependency + stderr + path'],
    ['markitdown._exceptions.FileConversionException: PdfConverter failed', 'MarkItDown exception'],
    ['Traceback (most recent call last):\n  File "site-packages/docling/...', 'multi-line traceback'],
  ];

  for (const [raw, label] of leakyErrors) {
    const s = sanitizeErrorMessage(raw);
    for (const t of FORBIDDEN_UI_TERMS) {
      assert.ok(!s.includes(t), `"${label}": must not leak "${t}". Got: "${s.slice(0, 80)}"`);
    }
  }

  // ═══ 2: bridge ok=true but output empty → should be FAILED (not completed) ═══
  // This is a logic check: the engine must not report success when markdown is empty
  {
    const bridge = validateBridgeOutput({ ok: true, pageCount: 10 });
    assert.equal(bridge.ok, true);
    // If the output file is empty (0 bytes), the engine must return ok=false
    // (This is tested in the engine itself, not the bridge)
  }

  // ═══ 3: Invalid JSON bridge output → generic Chinese fallback ═══
  const INVALID_JSON_FALLBACK = '论文导入返回无效数据。';
  for (const t of FORBIDDEN_UI_TERMS) {
    assert.ok(!INVALID_JSON_FALLBACK.includes(t), `fallback must not leak "${t}"`);
  }

  // ═══ 4: Safe Chinese error messages pass through unchanged ═══
  const SAFE_MESSAGES = [
    '论文导入失败。可稍后重试，或改用快速导入。',
    '论文导入未能生成有效内容。',
    '论文导入返回无效数据。',
    '论文导入超时，文档可能过大。',
    '论文导入暂不可用。',
  ];
  for (const m of SAFE_MESSAGES) {
    const s = sanitizeErrorMessage(m);
    assert.equal(s, m, `safe message must pass through: "${m}"`);
    for (const t of FORBIDDEN_UI_TERMS) {
      assert.ok(!s.includes(t), `safe message must not contain "${t}"`);
    }
  }

  // ═══ 5: Companion failed entry does not leak ═══
  const failedCompanion = {
    quality: 'failed' as const,
    error: {
      code: 'PRECISION_CONVERSION_FAILED',
      message: 'Document conversion failed.',
    },
  };
  const json = JSON.stringify(failedCompanion);
  for (const t of FORBIDDEN_UI_TERMS) {
    assert.ok(!json.includes(t), `companion JSON must not leak "${t}"`);
  }
  // The companion message "Document conversion failed." contains no forbidden terms
  // and passes sanitize unchanged. The engine now produces Chinese messages instead.
  const sanitizedCompanionMsg = sanitizeErrorMessage(failedCompanion.error.message);
  for (const t of FORBIDDEN_UI_TERMS) {
    assert.ok(!sanitizedCompanionMsg.includes(t), `companion msg must not leak "${t}"`);
  }

  // ═══ 6: Bare filename validation ═══
  assert.ok(isBareFilename('fig1.png'));
  assert.ok(!isBareFilename('dir/fig.png'));
  assert.ok(!isBareFilename('../escape.png'));

  console.log('[PASS] docling-engine.test.ts');
}

// LEGACY: CODE-QUALITY-IMP-4 — Docling archived. Test skipped.
console.log('[SKIP] docling-engine — Docling archived (Phase 4-0-CODE-QUALITY-IMP-4)');
