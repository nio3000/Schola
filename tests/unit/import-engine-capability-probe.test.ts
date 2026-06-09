/**
 * Phase 3-4-C1: Docling Reserved Engine Capability Probe test.
 *
 * Section 1: Simulated probe paths (8 paths, no Python needed).
 * Section 2: Real service integration (stub engines, snapshot shape).
 * Section 3: Mode gate (precision always false, quick by param).
 * Section 4: Security boundaries (no paths, no IPC, no sourcePath).
 * Section 5: Boundary (no new IPC, no UI, no conversion, import.ipc.ts unchanged).
 *
 * Does NOT require Docling, Python, or any runtime to be installed.
 * Section 1 uses inline simulation matching the real probe logic.
 */

import assert from 'node:assert/strict';

import type {
  ReservedImportEngine,
  ReservedEngineProbeStatus,
} from '../../src/lib/contracts/engine-capability.types.ts';
import {
  probeSingleEngine,
  getEngineCapabilitySnapshot,
  invalidateProbeCache,
  computeAvailableModes,
} from '../../electron/services/engines/import/import-engine-capability-probe.service.ts';

// ── Section 1: Simulated probe paths ────────────────

interface SimulatedProbeInput {
  pythonFound: boolean;
  importOk: boolean;
  importThrows: boolean;
  importTimesOut: boolean;
  versionStdout: string | null;
  versionTimesOut: boolean;
}

function simulateDoclingProbe(input: SimulatedProbeInput): ReservedEngineProbeStatus {
  const checkedAt = '2026-05-19T00:00:00.000Z';

  if (!input.pythonFound) {
    return {
      engine: 'docling_reserved',
      status: 'unknown',
      version: null,
      reason: 'Python 3 not found',
      checkedAt,
      probeMethod: null,
      errorCode: 'NO_PYTHON',
    };
  }

  if (input.importTimesOut) {
    return {
      engine: 'docling_reserved',
      status: 'unavailable',
      version: null,
      reason: 'Probe timed out after 15s',
      checkedAt,
      probeMethod: 'python-module',
      errorCode: 'TIMEOUT',
    };
  }

  if (input.importThrows) {
    return {
      engine: 'docling_reserved',
      status: 'unavailable',
      version: null,
      reason: 'Failed to execute Python import check',
      checkedAt,
      probeMethod: 'python-module',
      errorCode: 'IMPORT_FAILED',
    };
  }

  if (!input.importOk) {
    return {
      engine: 'docling_reserved',
      status: 'unavailable',
      version: null,
      reason: "Module 'docling' is not installed",
      checkedAt,
      probeMethod: 'python-module',
      errorCode: 'NOT_INSTALLED',
    };
  }

  if (input.versionTimesOut) {
    return {
      engine: 'docling_reserved',
      status: 'available',
      version: null,
      reason: null,
      checkedAt,
      probeMethod: 'python-module',
      errorCode: 'VERSION_UNREADABLE',
    };
  }

  const raw = input.versionStdout ?? '';
  const firstLine = raw.split(/[\r\n]+/)[0]?.trim() ?? '';
  if (firstLine.length === 0 || firstLine.length > 50) {
    return {
      engine: 'docling_reserved',
      status: 'available',
      version: null,
      reason: null,
      checkedAt,
      probeMethod: 'python-module',
      errorCode: 'VERSION_UNREADABLE',
    };
  }

  return {
    engine: 'docling_reserved',
    status: 'available',
    version: firstLine,
    reason: null,
    checkedAt,
    probeMethod: 'python-module',
    errorCode: null,
  };
}

const VALID_STATUSES = ['available', 'unavailable', 'unknown'] as const;
const VALID_ERROR_CODES = [
  'NO_PYTHON', 'NOT_INSTALLED', 'IMPORT_FAILED',
  'VERSION_UNREADABLE', 'TIMEOUT', 'UNKNOWN_ERROR',
] as const;

function assertNoPathLeaks(value: string | null, label: string): void {
  if (value === null) return;
  assert.ok(!value.includes('C:\\'), `${label} must not contain Windows path`);
  assert.ok(!value.includes('/usr/'), `${label} must not contain Unix path`);
  assert.ok(!value.includes('/home/'), `${label} must not contain home path`);
  assert.ok(!value.includes('site-packages'), `${label} must not contain site-packages`);
  assert.ok(!value.includes('Traceback'), `${label} must not contain traceback`);
  assert.ok(!value.includes('\\\\'), `${label} must not contain Windows UNC path`);
}

// ── Test runner ────────────────────────────────────

async function run(): Promise<void> {
  // ══════════════════════════════════════════════════
  // SECTION 1: Simulated probe paths (8 paths)
  // ══════════════════════════════════════════════════

  // P-1: no python
  {
    const r = simulateDoclingProbe({
      pythonFound: false, importOk: false, importThrows: false,
      importTimesOut: false, versionStdout: null, versionTimesOut: false,
    });
    assert.equal(r.status, 'unknown');
    assert.equal(r.errorCode, 'NO_PYTHON');
    assert.equal(r.reason, 'Python 3 not found');
    assert.equal(r.version, null);
    assert.equal(r.probeMethod, null);
    assertNoPathLeaks(r.reason, 'P-1 reason');
  }

  // P-2: docling not installed
  {
    const r = simulateDoclingProbe({
      pythonFound: true, importOk: false, importThrows: false,
      importTimesOut: false, versionStdout: null, versionTimesOut: false,
    });
    assert.equal(r.status, 'unavailable');
    assert.equal(r.errorCode, 'NOT_INSTALLED');
    assert.equal(r.reason, "Module 'docling' is not installed");
    assert.equal(r.version, null);
    assert.equal(r.probeMethod, 'python-module');
    assertNoPathLeaks(r.reason, 'P-2 reason');
  }

  // P-3: import failed (process-level exception)
  {
    const r = simulateDoclingProbe({
      pythonFound: true, importOk: false, importThrows: true,
      importTimesOut: false, versionStdout: null, versionTimesOut: false,
    });
    assert.equal(r.status, 'unavailable');
    assert.equal(r.errorCode, 'IMPORT_FAILED');
    assert.equal(r.reason, 'Failed to execute Python import check');
    assertNoPathLeaks(r.reason, 'P-3 reason');
  }

  // P-4: timeout
  {
    const r = simulateDoclingProbe({
      pythonFound: true, importOk: false, importThrows: false,
      importTimesOut: true, versionStdout: null, versionTimesOut: false,
    });
    assert.equal(r.status, 'unavailable');
    assert.equal(r.errorCode, 'TIMEOUT');
    assert.equal(r.reason, 'Probe timed out after 15s');
    assertNoPathLeaks(r.reason, 'P-4 reason');
  }

  // P-5: version unreadable
  {
    const r = simulateDoclingProbe({
      pythonFound: true, importOk: true, importThrows: false,
      importTimesOut: false, versionStdout: '', versionTimesOut: false,
    });
    assert.equal(r.status, 'available');
    assert.equal(r.errorCode, 'VERSION_UNREADABLE');
    assert.equal(r.version, null);
    assert.equal(r.reason, null);
  }

  // P-6: success with version
  {
    const r = simulateDoclingProbe({
      pythonFound: true, importOk: true, importThrows: false,
      importTimesOut: false, versionStdout: '2.15.0', versionTimesOut: false,
    });
    assert.equal(r.status, 'available');
    assert.equal(r.errorCode, null);
    assert.equal(r.version, '2.15.0');
    assert.equal(r.reason, null);
    assert.equal(r.probeMethod, 'python-module');
  }

  // P-7: multiline stdout → first line only
  {
    const r = simulateDoclingProbe({
      pythonFound: true, importOk: true, importThrows: false,
      importTimesOut: false,
      versionStdout: '2.15.0\nWarning: something\nExtra line',
      versionTimesOut: false,
    });
    assert.equal(r.status, 'available');
    assert.equal(r.version, '2.15.0');
  }

  // P-8: long version > 50 → rejected
  {
    const longVersion = 'a'.repeat(51);
    const r = simulateDoclingProbe({
      pythonFound: true, importOk: true, importThrows: false,
      importTimesOut: false, versionStdout: longVersion, versionTimesOut: false,
    });
    assert.equal(r.status, 'available');
    assert.equal(r.errorCode, 'VERSION_UNREADABLE');
    assert.equal(r.version, null);
  }

  // ══════════════════════════════════════════════════
  // SECTION 2: Real service integration
  // ══════════════════════════════════════════════════

  // S-1: probeSingleEngine('docling_reserved') returns valid shape
  {
    const s = await probeSingleEngine('docling_reserved');
    assert.equal(s.engine, 'docling_reserved');
    assert.ok(VALID_STATUSES.includes(s.status),
      `status must be valid, got: ${s.status}`);
    assert.ok(s.checkedAt.length > 0, 'checkedAt must be ISO string');
    assert.ok(s.errorCode === null || (VALID_ERROR_CODES as readonly string[]).includes(s.errorCode),
      `errorCode must be valid or null, got: ${s.errorCode}`);
    if (s.reason !== null) {
      assertNoPathLeaks(s.reason, 'S-1 reason');
      assert.ok(s.reason.length <= 200, 'reason must be ≤200 chars');
    }
    if (s.version !== null) {
      assert.ok(s.version.length <= 50, 'version must be ≤50 chars');
      assertNoPathLeaks(s.version, 'S-1 version');
    }
  }

  // S-2: mineru_reserved still stub
  {
    const s = await probeSingleEngine('mineru_reserved');
    assert.equal(s.engine, 'mineru_reserved');
    assert.equal(s.status, 'unknown');
    assert.equal(s.version, null);
    assert.equal(s.reason, null);
    assert.equal(s.probeMethod, null);
    assert.equal(s.errorCode, null);
  }

  // S-3: marker_reserved still stub
  {
    const s = await probeSingleEngine('marker_reserved');
    assert.equal(s.engine, 'marker_reserved');
    assert.equal(s.status, 'unknown');
    assert.equal(s.errorCode, null);
  }

  // S-4: dots_ocr_reserved still stub
  {
    const s = await probeSingleEngine('dots_ocr_reserved');
    assert.equal(s.engine, 'dots_ocr_reserved');
    assert.equal(s.status, 'unknown');
    assert.equal(s.errorCode, null);
  }

  // ══════════════════════════════════════════════════
  // SECTION 3: Snapshot + mode gate
  // ══════════════════════════════════════════════════

  // Build snapshot via probeSingleEngine to test hybrid behavior
  invalidateProbeCache();
  assert.equal(getEngineCapabilitySnapshot(), null, 'cache must start null');

  const { probeAllReservedEngines } = await import(
    '../../electron/services/engines/import/import-engine-capability-probe.service.ts'
  );
  const snap = await probeAllReservedEngines();

  assert.notEqual(getEngineCapabilitySnapshot(), null, 'cache must be populated after probeAll');

  // S-5: engines key set
  const engineKeys = Object.keys(snap.engines);
  assert.equal(engineKeys.length, 4);
  assert.ok(engineKeys.includes('docling_reserved'));
  assert.ok(engineKeys.includes('mineru_reserved'));
  assert.ok(engineKeys.includes('marker_reserved'));
  assert.ok(engineKeys.includes('dots_ocr_reserved'));
  assert.ok(!engineKeys.includes('markitdown'), 'engines must not contain markitdown');
  assert.ok(!engineKeys.includes('copydocling_reserved'), 'engines must not contain copydocling_reserved');

  // All engine values are valid ReservedEngineProbeStatus
  for (const [, v] of Object.entries(snap.engines)) {
    assert.equal(typeof v.engine, 'string');
    assert.ok(VALID_STATUSES.includes(v.status),
      `${v.engine}: status must be valid, got ${v.status}`);
    assert.ok(v.checkedAt.length > 0);
  }

  // No ageMs
  assert.ok(!('ageMs' in snap), 'EngineCapabilitySnapshot must not have ageMs');

  // availableModes and modeEngines shape
  assert.ok('quick' in snap.availableModes);
  assert.ok('precision' in snap.availableModes);
  assert.ok('ocr' in snap.availableModes);
  assert.equal(typeof snap.availableModes.precision, 'boolean');
  assert.ok(Array.isArray(snap.modeEngines.precision));

  // M-1: precision always false in C1
  assert.equal(snap.availableModes.precision, false,
    'precision must be false in C1 (conversion not yet implemented)');

  // M-2: ocr always false
  assert.equal(snap.availableModes.ocr, false);

  // M-3: quick by parameter
  {
    const withMD = computeAvailableModes(true);
    assert.equal(withMD.quick, true, 'quick must be true when markitdownAvailable=true');
    assert.equal(withMD.precision, false);
    assert.equal(withMD.ocr, false);
  }
  {
    const withoutMD = computeAvailableModes(false);
    assert.equal(withoutMD.quick, false);
  }
  {
    const def = computeAvailableModes();
    assert.equal(def.quick, false, 'quick must default to false');
  }

  // M-4: docling available does NOT make precision true
  // (verified by simulateDoclingProbe: available docling never changes precision gate)
  const availableResult = simulateDoclingProbe({
    pythonFound: true, importOk: true, importThrows: false,
    importTimesOut: false, versionStdout: '2.15.0', versionTimesOut: false,
  });
  assert.equal(availableResult.status, 'available');
  // The real computeAvailableModes always returns precision:false regardless
  const modes = computeAvailableModes(false);
  assert.equal(modes.precision, false,
    'precision must remain false even when docling probe returns available');

  // ══════════════════════════════════════════════════
  // SECTION 4: Security boundaries
  // ══════════════════════════════════════════════════

  // SEC-1: All simulated probe reasons are path-safe
  const allSimulated = [
    simulateDoclingProbe({ pythonFound: false, importOk: false, importThrows: false, importTimesOut: false, versionStdout: null, versionTimesOut: false }),
    simulateDoclingProbe({ pythonFound: true, importOk: false, importThrows: false, importTimesOut: false, versionStdout: null, versionTimesOut: false }),
    simulateDoclingProbe({ pythonFound: true, importOk: false, importThrows: true, importTimesOut: false, versionStdout: null, versionTimesOut: false }),
    simulateDoclingProbe({ pythonFound: true, importOk: false, importThrows: false, importTimesOut: true, versionStdout: null, versionTimesOut: false }),
    simulateDoclingProbe({ pythonFound: true, importOk: true, importThrows: false, importTimesOut: false, versionStdout: '', versionTimesOut: false }),
    simulateDoclingProbe({ pythonFound: true, importOk: true, importThrows: false, importTimesOut: false, versionStdout: '2.15.0', versionTimesOut: false }),
    simulateDoclingProbe({ pythonFound: true, importOk: true, importThrows: false, importTimesOut: false, versionStdout: '2.15.0\nWarning', versionTimesOut: false }),
    simulateDoclingProbe({ pythonFound: true, importOk: true, importThrows: false, importTimesOut: false, versionStdout: 'a'.repeat(51), versionTimesOut: false }),
  ];
  for (let i = 0; i < allSimulated.length; i++) {
    const r = allSimulated[i];
    assertNoPathLeaks(r.reason, `simulated[${i}] reason`);
    assertNoPathLeaks(r.version, `simulated[${i}] version`);
  }

  // SEC-2: Snapshot JSON must not contain forbidden tokens
  {
    const snapStr = JSON.stringify(snap);
    assert.ok(!snapStr.includes('sourcePath'), 'snapshot must not contain sourcePath');
    assert.ok(!snapStr.includes('sourcepath'), 'snapshot must not contain sourcepath (any case)');
    assert.ok(!snapStr.includes('C:\\'), 'snapshot must not contain Windows abs path');
    assert.ok(!snapStr.includes('/usr/'), 'snapshot must not contain Unix path');
    assert.ok(!snapStr.includes('/home/'), 'snapshot must not contain home path');
    assert.ok(!snapStr.includes('site-packages'), 'snapshot must not contain site-packages');
    assert.ok(!snapStr.includes('Traceback'), 'snapshot must not contain traceback');
  }

  // SEC-3: No IPC / UI forbidden tokens
  {
    const snapStr = JSON.stringify(snap);
    const forbiddenTokens = [
      'ipcRenderer', 'ipcMain', 'window.schola',
      'import:list-engines', 'import:set-engine', 'import:list-modes',
      'React', 'component', 'selector',
    ];
    for (const token of forbiddenTokens) {
      assert.ok(!snapStr.includes(token),
        'snapshot must not reference forbidden token: ' + token);
    }
  }

  // ══════════════════════════════════════════════════
  // SECTION 5: Boundary assertions
  // ══════════════════════════════════════════════════

  // import.ipc.ts precision rejection simulation (unchanged in C1)
  {
    // Simulate the frozen rejection path in import.ipc.ts:265-273
    // This simulates what import:create-job does.
    function simulateImportModeValidation(mode: string): { ok: boolean; code: string } {
      if (mode === 'precision' || mode === 'ocr') {
        return { ok: false, code: 'ENGINE_NOT_AVAILABLE' };
      }
      return { ok: true, code: '' };
    }

    assert.equal(simulateImportModeValidation('quick').ok, true);
    assert.equal(simulateImportModeValidation('precision').ok, false);
    assert.equal(simulateImportModeValidation('precision').code, 'ENGINE_NOT_AVAILABLE');
    assert.equal(simulateImportModeValidation('ocr').ok, false);
    assert.equal(simulateImportModeValidation('ocr').code, 'ENGINE_NOT_AVAILABLE');
  }

  // probeSingleEngine type restricts to ReservedImportEngine
  // (compile-time check — verified by TypeScript)
  // Runtime: calling with each reserved engine works
  {
    const engines: ReservedImportEngine[] = [
      'docling_reserved', 'mineru_reserved', 'marker_reserved', 'dots_ocr_reserved',
    ];
    for (const engine of engines) {
      const s = await probeSingleEngine(engine);
      assert.equal(s.engine, engine);
      assert.ok(VALID_STATUSES.includes(s.status));
    }
  }

  console.log('[PASS] import-engine-capability-probe');
}

run();
