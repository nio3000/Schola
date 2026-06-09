/**
 * Phase 3-1-A: reserved engine reject test.
 *
 * Verifies that reserved import and export engines exist in the
 * type registry with status 'reserved', that they are never marked
 * as enabled, and that the default engines are correct.
 *
 * ⚠️  Static contract test — no runtime dependencies.
 */

import assert from 'node:assert/strict';
import {
  RESERVED_IMPORT_ENGINES,
  RESERVED_EXPORT_ENGINES,
  DEFAULT_IMPORT_ENGINE,
  DEFAULT_EXPORT_ENGINE,
} from '../../src/lib/contracts/engine-registry.types.ts';

function run(): void {
  // ── Reserved import engines ──────────────────
  const importKeys = Object.keys(RESERVED_IMPORT_ENGINES);
  assert.equal(importKeys.length, 4, 'Expected 4 reserved import engines');
  assert.ok(importKeys.includes('docling_reserved'), 'Missing docling_reserved');
  assert.ok(importKeys.includes('mineru_reserved'), 'Missing mineru_reserved');
  assert.ok(importKeys.includes('marker_reserved'), 'Missing marker_reserved');
  assert.ok(importKeys.includes('dots_ocr_reserved'), 'Missing dots_ocr_reserved');

  for (const key of importKeys) {
    const engine = RESERVED_IMPORT_ENGINES[key];
    assert.equal(engine.status, 'reserved', `${key} must be reserved, not ${engine.status}`);
    assert.ok(!(engine.engine === DEFAULT_IMPORT_ENGINE), `${key} must not be the default engine`);
  }

  // ── Reserved export engines ──────────────────
  const exportKeys = Object.keys(RESERVED_EXPORT_ENGINES);
  assert.equal(exportKeys.length, 3, 'Expected 3 reserved export engines');
  assert.ok(exportKeys.includes('weasyprint_reserved'), 'Missing weasyprint_reserved');
  assert.ok(exportKeys.includes('typst_reserved'), 'Missing typst_reserved');
  assert.ok(exportKeys.includes('princexml_reserved'), 'Missing princexml_reserved');

  for (const key of exportKeys) {
    const engine = RESERVED_EXPORT_ENGINES[key];
    assert.equal(engine.status, 'reserved', `${key} must be reserved, not ${engine.status}`);
    assert.ok(!(engine.engine === DEFAULT_EXPORT_ENGINE), `${key} must not be the default engine`);
  }

  // ── Default engines ──────────────────────────
  assert.equal(DEFAULT_IMPORT_ENGINE, 'markitdown', 'Default import engine must be markitdown');
  assert.equal(DEFAULT_EXPORT_ENGINE, 'pandoc', 'Default export engine must be pandoc');
}

run();
console.log('[PASS] reserved-engine-reject');
