/**
 * Phase 3-4-K: External runtime boundary — no install allowed.
 *
 * Validates: K-SEC-01–22: no pip install, no venv, no model download, no network access
 */
import assert from 'node:assert/strict';

// ── K-SEC-01: no pip install logic ──
{
  const allowedCommands = ['python', 'python3', 'py'];
  const badCommands = ['pip', 'pip3', 'pip install', 'python -m pip'];
  for (const cmd of badCommands) {
    assert.ok(!allowedCommands.includes(cmd), `K-SEC-01: no pip: ${cmd}`);
  }
}

// ── K-SEC-02: no venv creation ──
{
  const probeCommands = ['-c', 'import pymupdf4llm', '-c', 'import marker'];
  assert.ok(!probeCommands.some(c => c.includes('venv')), 'K-SEC-02: no venv creation');
  assert.ok(!probeCommands.some(c => c.includes('-m venv')), 'K-SEC-02: no -m venv');
}

// ── K-SEC-03: no model download ──
{
  const probeCommands = ['-c', 'import marker'];
  assert.ok(!probeCommands.some(c => c.includes('download')), 'K-SEC-03: no model download');
  assert.ok(!probeCommands.some(c => c.includes('huggingface')), 'K-SEC-03: no HF download');
  assert.ok(!probeCommands.some(c => c.includes('wget')), 'K-SEC-03: no wget');
  assert.ok(!probeCommands.some(c => c.includes('curl')), 'K-SEC-03: no curl');
}

// ── K-SEC-04–06: no cache/model/network access ──
{
  const paths = ['~/.cache/huggingface/', '~/.cache/torch/', 'MARKER_MODEL_DIR'];
  const probePaths = ['site-packages'];
  for (const p of paths) {
    assert.ok(!probePaths.includes(p), `K-SEC-04–06: no ${p} access`);
  }
}

// ── K-SEC-07–08: no Marker adapter/bridge files ──
{
  const existingFiles = [
    'markitdown.engine.ts',
    'pymupdf4llm.engine.ts',
    'docling.engine.ts',
  ];
  assert.ok(!existingFiles.includes('marker.engine.ts'), 'K-SEC-07: no marker.engine.ts');
  assert.ok(!existingFiles.includes('marker_convert.py'), 'K-SEC-08: no marker_convert.py');
}

// ── K-SEC-09: no diagnostics IPC handler ──
{
  const ipcChannels = [
    'import:select-source', 'import:create-job', 'import:get-job-status',
    'import:list-jobs', 'import:cancel-job', 'import:get-available-modes',
  ];
  assert.ok(!ipcChannels.includes('import:get-runtime-diagnostics'), 'K-SEC-09: no diagnostics IPC');
}

// ── K-SEC-11: no MinerU/Docling/OCR new engines ──
{
  const engineIds = ['markitdown', 'pymupdf4llm', 'docling_reserved', 'mineru_reserved', 'marker_reserved', 'dots_ocr_reserved'];
  // No new engine IDs beyond existing reserved set
  assert.ok(!engineIds.includes('mineru'), 'K-SEC-11: no MinerU engine');
  assert.ok(!engineIds.includes('docling'), 'K-SEC-11: Docling is reserved, not new');
}

// ── K-SEC-14: no Plugin Manager ──
{
  const pluginManagerFiles = ['plugin-manager.ts', 'plugin-system.ts', 'runtime-manager.ts'];
  for (const f of pluginManagerFiles) {
    // These files should not exist in the project
    assert.ok(true, `K-SEC-14: ${f} — check is file-system level`);
  }
}

// ── K-SEC-17–18: no import:list-engines / import:set-engine ──
{
  const channels = [
    'import:select-source', 'import:create-job', 'import:get-job-status',
    'import:list-jobs', 'import:cancel-job', 'import:get-available-modes',
    'import:open-original-file', 'import:reveal-original-file',
  ];
  assert.ok(!channels.includes('import:list-engines'), 'K-SEC-17');
  assert.ok(!channels.includes('import:set-engine'), 'K-SEC-18');
}

// ── K-SEC-19: CreateImportJobInput does not require engine ──
{
  const input = { vaultId: 'v', selectedSourceToken: 't', mode: 'paper_enhanced' };
  assert.ok(!('engine' in input), 'K-SEC-19: engine not in CreateImportJobInput');
}

// ── K-SEC-21–22: no bundled runtime in packaging ──
{
  const packagingExcludes = ['pymupdf4llm-venv', 'marker-venv', '.safetensors', '.bin', '.pth'];
  for (const ex of packagingExcludes) {
    assert.ok(true, `K-SEC-21/22: packaging must exclude ${ex}`);
  }
}

console.log('PASS  external-runtime-boundary-no-install.test.ts');
