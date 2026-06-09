/**
 * Phase 3-4-B: Import registry mode test.
 *
 * Verifies RESERVED_IMPORT_ENGINES profiles have correct
 * mode, status, and capabilities.
 */

import assert from 'node:assert/strict';
import { RESERVED_IMPORT_ENGINES } from '../../src/lib/contracts/engine-registry.types.ts';

function run(): void {
  const engines = RESERVED_IMPORT_ENGINES;

  // ═══ All reserved profiles present ═══
  assert.ok('docling_reserved' in engines, 'Missing docling_reserved');
  assert.ok('mineru_reserved' in engines, 'Missing mineru_reserved');
  assert.ok('marker_reserved' in engines, 'Missing marker_reserved');
  assert.ok('dots_ocr_reserved' in engines, 'Missing dots_ocr_reserved');

  // ═══ Status must be reserved ═══
  for (const [key, profile] of Object.entries(engines)) {
    assert.equal(profile.status, 'reserved', key + ' must be reserved');
  }

  // ═══ Mode must be correct ═══
  assert.equal(engines.docling_reserved.mode, 'precision');
  assert.equal(engines.mineru_reserved.mode, 'precision');
  assert.equal(engines.marker_reserved.mode, 'precision');
  assert.equal(engines.dots_ocr_reserved.mode, 'ocr');

  // ═══ Capabilities include new Phase 3-4-B values ═══
  assert.ok(engines.docling_reserved.capabilities.includes('layout-aware'));
  assert.ok(engines.docling_reserved.capabilities.includes('figure-extraction'));
  assert.ok(engines.mineru_reserved.capabilities.includes('chinese-layout'));
  assert.ok(engines.marker_reserved.capabilities.includes('equation-extraction'));

  // ═══ qualityNotes are present ═══
  for (const [, profile] of Object.entries(engines)) {
    assert.ok(profile.qualityNotes && profile.qualityNotes.length > 0,
      'qualityNotes must be present for ' + profile.engine);
  }

  // ═══ No profile is enabled ═══
  for (const [, profile] of Object.entries(engines)) {
    assert.notEqual(profile.status, 'enabled',
      profile.engine + ' must not be enabled');
  }

  console.log('[PASS] import-registry-mode');
}

run();
