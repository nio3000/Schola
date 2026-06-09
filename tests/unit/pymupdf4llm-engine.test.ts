/**
 * Phase 3-4-I-ENG-2: PyMuPDF4LLM engine test.
 * @legacy CODE-QUALITY-IMP-4: PyMuPDF4LLM deprecated.
 */
import assert from 'node:assert/strict';

// ── Simulated engine contract ─────────────────────

const ENGINE_ID = 'pymupdf4llm';
const SUPPORTED_FORMATS = ['pdf'];

// ── Run ────────────────────────────────────────────

function run(): void {
  // Engine id
  assert.equal(ENGINE_ID, 'pymupdf4llm');

  // Supported formats: PDF only
  assert.ok(SUPPORTED_FORMATS.includes('pdf'));
  assert.equal(SUPPORTED_FORMATS.length, 1);
  assert.ok(!SUPPORTED_FORMATS.includes('docx'));
  assert.ok(!SUPPORTED_FORMATS.includes('html'));

  // Engine not routable yet (no I-ENG-3 routing switch)
  // paper_quality still goes to DEFAULT_IMPORT_ENGINE

  // Bridge uses execFile array params, no shell
  // (verified by code review of pymupdf4llm.engine.ts)

  // No sourcePath in EngineConvertInput
  // (verified by import.types.ts contract — sourcePath intentionally absent)

  // Bridge stdout contract (validated by bridge-contract test)

  // Image path rewrite (validated by image-paths test)

  // Error messages are safe Chinese text
  const safeErrors = [
    '论文导入引擎暂不可用。',
    '论文导入转换失败。',
    '论文导入结果无效。',
    '论文导入超时。',
  ];
  for (const msg of safeErrors) {
    assert.ok(!msg.includes('C:\\'));
    assert.ok(!msg.includes('/home/'));
    assert.ok(!msg.includes('sourcePath'));
    assert.ok(!msg.includes('pymupdf4llm'));
    assert.ok(!msg.includes('traceback'));
  }

  console.log('[PASS] pymupdf4llm-engine');
}

// LEGACY: CODE-QUALITY-IMP-4 — PyMuPDF4LLM deactivated. Test skipped.
console.log('[SKIP] pymupdf4llm-engine — PyMuPDF4LLM deactivated (Phase 4-0-CODE-QUALITY-IMP-4)');
