/**
 * Phase 3-1-A: _exports/ exclusion test.
 *
 * Verifies that isExcludedSystemPath correctly identifies paths
 * inside the _exports/ directory while NOT matching false positives.
 *
 * ⚠️  Does NOT depend on MarkItDown, Pandoc, LaTeX, or any runtime.
 */

import assert from 'node:assert/strict';
import { isExcludedSystemPath } from '../../electron/security/path-guard';

function run(): void {
  // ── Direct match ────────────────────────────
  assert.equal(isExcludedSystemPath('_exports'), true);
  assert.equal(isExcludedSystemPath('_exports/'), true);
  assert.equal(isExcludedSystemPath('_exports/output.docx'), true);
  assert.equal(isExcludedSystemPath('_exports/2026/05/export_001/output.pdf'), true);

  // ── False positives (must NOT match) ─────────
  assert.equal(isExcludedSystemPath('notes/my-exports-note.md'), false);
  assert.equal(isExcludedSystemPath('notes/exports_list.md'), false);
  assert.equal(isExcludedSystemPath('papers/section_exports.md'), false);
  assert.equal(isExcludedSystemPath('_export'), false);       // prefix only
  assert.equal(isExcludedSystemPath('exports/'), false);       // no underscore

  // ── Windows separators ───────────────────────
  assert.equal(isExcludedSystemPath('_exports\\output.docx'), true);
  assert.equal(isExcludedSystemPath('_exports\\2026\\05\\export_001\\output.pdf'), true);
  assert.equal(isExcludedSystemPath('notes\\my-exports-note.md'), false);
}

run();
console.log('[PASS] _exports-exclusion');
