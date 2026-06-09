/**
 * Phase 3-4-D: Import select-source formatFilter test.
 *
 * Sections: 1. Whitelist validation  2. Precision PDF filter
 *           3. Undefined default  4. Illegal filter rejection
 */
import assert from 'node:assert/strict';

// ── Helpers ─────────────────────────────────────

const ALLOWED_FORMATS = new Set(['pdf', 'docx', 'pptx', 'xlsx', 'html']);

function validateFormatFilter(input?: readonly string[]): string[] {
  if (!input || input.length === 0) return ['pdf', 'docx'];
  const valid = input.filter(f => ALLOWED_FORMATS.has(f));
  return valid.length > 0 ? valid : ['pdf', 'docx'];
}

// Simulate the select-source handler logic
function resolveExtensions(input?: { formatFilter?: readonly string[] }): string[] {
  const requested = input?.formatFilter ?? [];
  const valid = requested.length > 0
    ? requested.filter(f => ALLOWED_FORMATS.has(f))
    : ['pdf', 'docx'];
  return valid.length > 0 ? valid : ['pdf', 'docx'];
}

// ── Run ────────────────────────────────────────

function run(): void {
  // ═══ 1: ['pdf'] is valid ═══
  assert.deepEqual(validateFormatFilter(['pdf']), ['pdf']);

  // ═══ 2: ['docx', 'pdf'] is valid ═══
  assert.deepEqual(validateFormatFilter(['docx', 'pdf']), ['docx', 'pdf']);

  // ═══ 3: ['exe'] filtered out → fallback default ═══
  assert.deepEqual(validateFormatFilter(['exe']), ['pdf', 'docx']);

  // ═══ 4: ['../../../'] filtered out → fallback default ═══
  assert.deepEqual(validateFormatFilter(['../../../']), ['pdf', 'docx']);

  // ═══ 5: Empty array → default ═══
  assert.deepEqual(validateFormatFilter([]), ['pdf', 'docx']);

  // ═══ 6: Undefined → default ═══
  assert.deepEqual(validateFormatFilter(undefined), ['pdf', 'docx']);

  // ═══ 7: Mixed valid + invalid → only valid remain ═══
  assert.deepEqual(validateFormatFilter(['pdf', 'exe', 'docx']), ['pdf', 'docx']);

  // ═══ 8: All invalid → fallback ═══
  assert.deepEqual(validateFormatFilter(['exe', 'sh', 'bat']), ['pdf', 'docx']);

  // ═══ 9: resolveExtensions with SelectImportSourceInput shape ═══
  assert.deepEqual(resolveExtensions({ formatFilter: ['pdf'] }), ['pdf']);
  assert.deepEqual(resolveExtensions({ formatFilter: ['docx'] }), ['docx']);
  assert.deepEqual(resolveExtensions({ formatFilter: ['pptx', 'html'] }), ['pptx', 'html']);
  assert.deepEqual(resolveExtensions({ formatFilter: [] }), ['pdf', 'docx']);
  assert.deepEqual(resolveExtensions(undefined), ['pdf', 'docx']);
  assert.deepEqual(resolveExtensions({}), ['pdf', 'docx']);

  // ═══ 10: Precision import uses ['pdf'] ═══
  const precisionFilter = ['pdf'];
  assert.deepEqual(validateFormatFilter(precisionFilter), ['pdf']);
  assert.ok(ALLOWED_FORMATS.has('pdf'));

  console.log('[PASS] import-select-source-filter');
}

run();
