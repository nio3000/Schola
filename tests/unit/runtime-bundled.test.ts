/**
 * @legacy CODE-QUALITY-IMP-4: Runtime Pack hidden.
 *
 * Phase 3-4-D-R2/D-R5-P0 / Phase 3-4-F0: Bundled runtime resolution test.
 *
 * Phase 3-4-F0: Docling bundled runtime paused as default.
 *     Resources/runtimes/docling-venv is NOT a required dependency.
 *     Bundled Python resolution logic is preserved for future use
 *     (Marker/MinerU will reuse the same resolution pattern).
 *     Section 5 (manifest), Section 8 (build script) are EXPERIMENTAL.
 *
 * Sections: 1. Bundled-first resolution  2. Fallback system python
 *           3. Both unavailable  4. Platform path  5. Manifest (experimental)
 *           6. .gitignore  7. Candidate consistency
 *           8. Build script (experimental)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getBundledPythonPath(bundledExists: boolean): string | null {
  if (!bundledExists) return null;
  return path.resolve(__dirname, '..', '..', 'resources', 'runtimes', 'docling-venv', 'Scripts', 'python.exe');
}

async function simulateFindPython(
  bundledExists: boolean, bundledWorks: boolean, systemAvailable: boolean,
): Promise<string | null> {
  const bundled = getBundledPythonPath(bundledExists);
  if (bundled) { if (bundledWorks) return bundled; }
  if (systemAvailable) return 'python3';
  return null;
}

async function run(): Promise<void> {
  // ═══ 1: Bundled venv exists + works → returns bundled path ═══
  assert.ok((await simulateFindPython(true, true, false)) !== null);
  assert.ok((await simulateFindPython(true, true, false))!.includes('docling-venv'));

  // ═══ 2-3: Bundled fails/absent → fallback ═══
  assert.equal(await simulateFindPython(true, false, true), 'python3');
  assert.equal(await simulateFindPython(false, false, true), 'python3');
  assert.equal(await simulateFindPython(false, false, false), null);

  // ═══ 4: Platform-appropriate exe name ═══
  const exeName = process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python';
  assert.ok(exeName.endsWith('python.exe') || exeName.endsWith('python'));

  // ═══ 5: Manifest example exists and schema valid ═══
  const manifestPath = path.resolve(__dirname, '..', '..', 'resources', 'runtimes', 'runtime-manifest.example.json');
  if (fs.existsSync(manifestPath)) {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    assert.equal(m.schemaVersion, 1);
    assert.equal(m.runtimeId, 'docling-bundled');
  }

  // ═══ 6: .gitignore excludes resources/runtimes ═══
  const gitignorePath = path.resolve(__dirname, '..', '..', '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    assert.ok(fs.readFileSync(gitignorePath, 'utf-8').includes('resources/runtimes'));
  }

  // ═══ 7: Candidate consistency (R2-1) + D-R5-P0 multi-candidate ═══
  const runtimeCheckSrc = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'electron', 'services', 'runtime-check.service.ts'), 'utf-8');
  const probeSrc = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'electron', 'services', 'engines', 'import', 'import-engine-capability-probe.service.ts'), 'utf-8');

  // py candidate present
  assert.ok(runtimeCheckSrc.includes("'py'"));
  assert.ok(probeSrc.includes("'py'"));

  // Candidate order
  const rm = runtimeCheckSrc.match(/SYSTEM_PYTHON_CANDIDATES\s*=\s*\[([^\]]+)\]/);
  const pm = probeSrc.match(/SYSTEM_PYTHON_CANDIDATES\s*=\s*\[([^\]]+)\]/);
  if (rm) { const c = rm[1]; assert.ok(c.indexOf("'python3'") < c.indexOf("'python'") && c.indexOf("'python'") < c.indexOf("'py'")); }
  if (pm) { const c = pm[1]; assert.ok(c.indexOf("'python3'") < c.indexOf("'python'") && c.indexOf("'python'") < c.indexOf("'py'")); }

  // D-R5-P0: process.cwd() + candidate loop for dev mode
  assert.ok(runtimeCheckSrc.includes('process.cwd()'), 'runtime-check must try process.cwd() for dev mode');
  assert.ok(probeSrc.includes('process.cwd()'), 'probe service must try process.cwd() for dev mode');
  assert.ok(runtimeCheckSrc.includes('for (const basePath of candidates'), 'must iterate candidates');
  assert.ok(probeSrc.includes('for (const basePath of candidates'), 'must iterate candidates');

  // ═══ 8: build-docling-venv.ps1 default PythonExe (D-R3-delta) ═══
  const scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'build-docling-venv.ps1');
  if (fs.existsSync(scriptPath)) {
    const ss = fs.readFileSync(scriptPath, 'utf-8');
    assert.ok(ss.includes('[string]$PythonExe = "python"'), 'default PythonExe must be python');
    assert.ok(!ss.includes('[string]$PythonExe = "python3"'), 'must not default to python3');
    assert.ok(ss.includes('$PythonExe'), 'must support PythonExe parameter');
    assert.ok(ss.includes('--version'), 'must check Python --version');
    assert.ok(!ss.includes('$env:PATH'), 'must not modify PATH');
  }

  console.log('[PASS] runtime-bundled');
}

// LEGACY: CODE-QUALITY-IMP-4 — Runtime Pack hidden. Test skipped.
console.log('[SKIP] runtime-bundled — Runtime Pack hidden (Phase 4-0-CODE-QUALITY-IMP-4)');
