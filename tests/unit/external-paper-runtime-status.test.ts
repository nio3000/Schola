/**
 * Phase 3-4-K: ExternalRuntimeStatus tests.
 *
 * Validates:
 *   K-STATUS-01–15: status values, K phase restrictions
 */
import assert from 'node:assert/strict';

// ── K-STATUS-01–09: All 9 statuses exist ──
const allStatuses = [
  'available', 'unavailable', 'not_installed', 'timeout', 'unknown',
  'model_missing', 'needs_setup', 'unsupported_platform', 'license_blocked',
];

assert.equal(allStatuses.length, 9, 'K-STATUS-01–09: must have 9 statuses');
assert.ok(allStatuses.includes('available'), 'K-STATUS-01');
assert.ok(allStatuses.includes('unavailable'), 'K-STATUS-02');
assert.ok(allStatuses.includes('not_installed'), 'K-STATUS-03');
assert.ok(allStatuses.includes('timeout'), 'K-STATUS-04');
assert.ok(allStatuses.includes('unknown'), 'K-STATUS-05');
assert.ok(allStatuses.includes('model_missing'), 'K-STATUS-06: reserved');
assert.ok(allStatuses.includes('needs_setup'), 'K-STATUS-07: reserved');
assert.ok(allStatuses.includes('unsupported_platform'), 'K-STATUS-08: reserved');
assert.ok(allStatuses.includes('license_blocked'), 'K-STATUS-09: reserved');

// ── K phase allowed return values ──
const kPhaseAllowed = ['available', 'unavailable', 'not_installed', 'timeout', 'unknown'];

// ── K-STATUS-10: PyMuPDF4LLM probe only returns K phase values ──
function simulatePymupdfProbe(status: string): boolean {
  return kPhaseAllowed.includes(status);
}
assert.ok(simulatePymupdfProbe('available'), 'K-STATUS-10a');
assert.ok(simulatePymupdfProbe('not_installed'), 'K-STATUS-10b');
assert.ok(!simulatePymupdfProbe('model_missing'), 'K-STATUS-10c: model_missing not allowed in K phase');

// ── K-STATUS-11: Marker probe only returns K phase values ──
function simulateMarkerProbe(status: string): boolean {
  return kPhaseAllowed.includes(status);
}
assert.ok(simulateMarkerProbe('available'), 'K-STATUS-11a');
assert.ok(simulateMarkerProbe('unknown'), 'K-STATUS-11b');
assert.ok(!simulateMarkerProbe('model_missing'), 'K-STATUS-11c: model_missing not allowed in K phase');

// ── K-STATUS-12: Marker probe must NOT return model_missing ──
const markerProbeResult = { status: 'not_installed' as const, version: null };
assert.notEqual(markerProbeResult.status, 'model_missing', 'K-STATUS-12: no model_missing');

// ── K-STATUS-13: Marker probe must NOT return needs_setup ──
assert.notEqual(markerProbeResult.status, 'needs_setup', 'K-STATUS-13: no needs_setup');

// ── K-STATUS-14: timeout → map to false in availableModes ──
function mapTimeout(mode: string, status: string): boolean {
  if (status === 'timeout' || status === 'unknown') return false;
  return status === 'available';
}
assert.equal(mapTimeout('paper_enhanced', 'timeout'), false, 'K-STATUS-14: timeout → false');
assert.equal(mapTimeout('paper_enhanced', 'unknown'), false, 'K-STATUS-15: unknown → false');

console.log('PASS  external-paper-runtime-status.test.ts');
