/**
 * Phase 3-1-A: _trash/ exclusion test.
 *
 * Verifies that isExcludedSystemPath correctly identifies paths
 * inside the _trash/ directory while NOT matching false positives.
 *
 * ⚠️  Does NOT depend on MarkItDown, Pandoc, LaTeX, or any runtime.
 */

import assert from 'node:assert/strict';
import { isExcludedSystemPath } from '../../electron/security/path-guard';

function run(): void {
  // ── Direct match ────────────────────────────
  assert.equal(isExcludedSystemPath('_trash'), true);
  assert.equal(isExcludedSystemPath('_trash/'), true);
  assert.equal(isExcludedSystemPath('_trash/deleted-note.md'), true);
  assert.equal(isExcludedSystemPath('_trash/2026/05/old-file.md'), true);

  // ── False positives ─────────────────────────
  assert.equal(isExcludedSystemPath('notes/trash-note.md'), false);
  assert.equal(isExcludedSystemPath('notes/trash-collection.md'), false);
  assert.equal(isExcludedSystemPath('_trashed'), false);       // prefix only
  assert.equal(isExcludedSystemPath('trash/'), false);          // no underscore

  // ── Windows separators ───────────────────────
  assert.equal(isExcludedSystemPath('_trash\\deleted.md'), true);
  assert.equal(isExcludedSystemPath('notes\\trash-note.md'), false);
}

run();
console.log('[PASS] _trash-exclusion');
