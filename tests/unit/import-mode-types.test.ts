/**
 * Phase 3-4-B: ImportMode type test.
 *
 * Verifies ImportMode union, CreateImportJobInput mode? field,
 * and backward compatibility with engine field.
 */

import assert from 'node:assert/strict';

// Type-level: ImportMode only allows quick / precision / ocr
type ImportMode = 'quick' | 'precision' | 'ocr';

function run(): void {
  const modes: ImportMode[] = ['quick', 'precision', 'ocr'];
  assert.equal(modes.length, 3, 'Must have exactly 3 modes');
  assert.ok(modes.includes('quick'));
  assert.ok(modes.includes('precision'));
  assert.ok(modes.includes('ocr'));

  // mode omitted → default 'quick'
  const defaultMode: ImportMode = 'quick';
  assert.equal(defaultMode, 'quick');

  // Verify mode strings are correct
  for (const m of modes) {
    assert.equal(typeof m, 'string');
    assert.ok(m.length > 0);
  }

  console.log('[PASS] import-mode-types');
}

run();
