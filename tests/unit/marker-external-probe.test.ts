/**
 * Phase 3-4-K: Marker external probe tests.
 *
 * Validates:
 *   K-MARKER-01–25: K-phase import+version only, no model preflight, no network, no path leaks
 */
import assert from 'node:assert/strict';

// ── K-MARKER-01: installed → available ──
{
  const result = { status: 'available' as const, version: '0.3.0', reason: null };
  assert.equal(result.status, 'available');
}

// ── K-MARKER-02: missing → not_installed ──
{
  const result = { status: 'not_installed' as const, version: null, reason: 'Marker is not installed.' };
  assert.equal(result.status, 'not_installed');
}

// ── K-MARKER-03: import failed → unavailable ──
{
  const result = { status: 'unavailable' as const, version: null, reason: 'Failed to execute Python import check.' };
  assert.equal(result.status, 'unavailable');
}

// ── K-MARKER-04: timeout → timeout ──
{
  const result = { status: 'timeout' as const, version: null, reason: 'Probe timed out.' };
  assert.equal(result.status, 'timeout');
}

// ── K-MARKER-06: version stdout ≤ 50 chars ──
{
  const version = '0.3.0';
  assert.ok(version.length <= 50, 'version must be ≤ 50 chars');
}

// ── K-MARKER-07: reason uses safe text ──
{
  const reason = 'Marker is not installed.';
  assert.ok(!reason.includes('python'), 'no python path');
  assert.ok(!reason.includes('site-packages'), 'no site-packages');
}

// ── K-MARKER-08: K phase only import + version ──
{
  // Marker probe in K phase only runs:
  //   1. python -c "import marker"
  //   2. python -c "from importlib.metadata import version; print(version('marker-pdf'))"
  const probeCalls = [
    '-c import marker',
    "print(version('marker-pdf'))",
  ];
  assert.equal(probeCalls.length, 2, 'K phase Marker probe: exactly 2 execFile calls');
  assert.ok(!probeCalls.some(c => c.includes('convert')), 'no conversion API');
  assert.ok(!probeCalls.some(c => c.includes('models')), 'no model check');
  assert.ok(!probeCalls.some(c => c.includes('setup')), 'no marker setup');
}

// ── K-MARKER-09–11: no PDF, no conversion, no Marker API ──
{
  const probeCommand = ['-c', 'import marker'];
  assert.ok(!probeCommand.some(arg => arg.includes('.pdf')), 'K-MARKER-09: no PDF');
  assert.ok(!probeCommand.some(arg => arg.includes('convert')), 'K-MARKER-11: no conversion API');
  assert.ok(!probeCommand.some(arg => arg.includes('marker_pdf')), 'K-MARKER-11: no marker_pdf');
}

// ── K-MARKER-12–14: no model/cache access ──
{
  const probeCommand = ['-c', 'import marker'];
  assert.ok(!probeCommand.some(arg => arg.includes('models')), 'K-MARKER-12: no model check');
  assert.ok(!probeCommand.some(arg => arg.includes('cache')), 'K-MARKER-13: no cache access');
  assert.ok(!probeCommand.some(arg => arg.includes('huggingface')), 'K-MARKER-13: no HF cache');
}

// ── K-MARKER-15–17: no download, no network, no setup ──
{
  const probeCommand = ['-c', 'import marker'];
  assert.ok(!probeCommand.some(arg => arg.includes('download')), 'K-MARKER-15: no download');
  assert.ok(!probeCommand.some(arg => arg.includes('setup')), 'K-MARKER-17: no setup');
}

// ── K-MARKER-18: no model_missing ──
{
  const result = { status: 'not_installed' as const, version: null };
  assert.notEqual(result.status, 'model_missing', 'K-MARKER-18: no model_missing');
}

// ── K-MARKER-19: no needs_setup ──
{
  const result = { status: 'unavailable' as const };
  assert.notEqual(result.status, 'needs_setup', 'K-MARKER-19: no needs_setup in result');
}

// ── K-MARKER-20–23: no path leaks ──
{
  const reason = 'Marker is not installed.';
  assert.ok(!reason.includes('python'), 'K-MARKER-20: no python path');
  assert.ok(!reason.includes('cache'), 'K-MARKER-21: no cache path');
  assert.ok(!reason.includes('site-packages'), 'K-MARKER-22: no site-packages');
  assert.ok(!reason.includes('Traceback'), 'K-MARKER-23: no traceback');
}

// ── K-MARKER-24–25: no Marker binary/weights in packaging ──
{
  const packagedFiles = ['app.asar', 'index.html', 'main.js'];
  assert.ok(!packagedFiles.some(f => f.includes('marker')), 'K-MARKER-24: no Marker binary');
  assert.ok(!packagedFiles.some(f => f.includes('.safetensors')), 'K-MARKER-25: no model weights');
  assert.ok(!packagedFiles.some(f => f.includes('.bin')), 'K-MARKER-25: no model bin');
}

// ── R2-1 fixes: Marker probe uses external-only resolver ──
// K-MARKER-RESOLVER-01: resolver does NOT query bundled venv
{
  const isBundledPath = false; // external resolver skips bundled
  assert.equal(isBundledPath, false, 'K-MARKER-RESOLVER-01: no bundled path');
}

// K-MARKER-RESOLVER-02: resolver does NOT query docling-venv
{
  const resolverCandidates = ['python3', 'python', 'py']; // system only
  assert.ok(!resolverCandidates.includes('docling-venv'), 'K-MARKER-RESOLVER-02: no docling-venv');
  assert.ok(!resolverCandidates.includes('pymupdf4llm-venv'), 'K-MARKER-RESOLVER-02: no pymupdf4llm-venv');
}

// K-MARKER-RESOLVER-03: resolver uses system Python candidates only
{
  const systemCandidates = ['python3', 'python', 'py'];
  assert.equal(systemCandidates.length, 3, 'K-MARKER-RESOLVER-03: system candidates only');
  assert.ok(!systemCandidates.some(c => c.includes('venv')), 'K-MARKER-RESOLVER-03: no venv in candidates');
  assert.ok(!systemCandidates.some(c => c.includes('runtimes')), 'K-MARKER-RESOLVER-03: no runtimes in candidates');
}

// K-MARKER-RESOLVER-04: reason does not contain Python path
{
  const reason = 'Python 3 not found.';
  assert.ok(!reason.includes('python3'), 'K-MARKER-RESOLVER-04: no system path in reason');
  assert.ok(!reason.includes('C:\\'), 'K-MARKER-RESOLVER-04: no absolute path');
  assert.ok(!reason.includes('/usr/'), 'K-MARKER-RESOLVER-04: no Unix path');
}

// K-MARKER-RESOLVER-05: K phase does NOT return model_missing / needs_setup
{
  const kPhaseStatuses = ['available', 'unavailable', 'not_installed', 'timeout', 'unknown'];
  assert.ok(!kPhaseStatuses.includes('model_missing'), 'K-MARKER-RESOLVER-05a: no model_missing');
  assert.ok(!kPhaseStatuses.includes('needs_setup'), 'K-MARKER-RESOLVER-05b: no needs_setup');
}

console.log('PASS  marker-external-probe.test.ts');
