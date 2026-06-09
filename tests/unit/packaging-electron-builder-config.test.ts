export {};
/**
 * Phase 4-0-P0-IMP: electron-builder configuration test.
 *
 * P0-CONFIG-01 ~ P0-CONFIG-18.
 * Verifies package.json build config is safe and minimal.
 */
const assert = require('node:assert/strict');
const path = require('node:path');

function run(): void {
  const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
  const pkg = require(pkgPath);
  const build = pkg.build;

  assert.ok(build, 'P0-CONFIG-01: build field exists');

  // ── Base config ──
  assert.equal(build.appId, 'com.schola.app', 'P0-CONFIG-02: appId');
  assert.equal(build.productName, 'Schola', 'P0-CONFIG-03: productName');
  assert.equal(build.directories.output, 'release', 'P0-CONFIG-04: output dir');

  // ── files whitelist ──
  assert.ok(Array.isArray(build.files), 'files is array');
  assert.ok(build.files.includes('dist/**/*'), 'P0-CONFIG-05: dist files');
  assert.ok(build.files.includes('dist-electron/**/*'), 'P0-CONFIG-06: dist-electron files');
  assert.ok(build.files.includes('package.json'), 'P0-CONFIG-07: package.json');

  // ── extraResources ──
  assert.ok(Array.isArray(build.extraResources), 'P0-CONFIG-08: extraResources exists');
  const er = build.extraResources[0];
  assert.ok(er, 'extraResources has entry');
  assert.equal(er.from, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'P0-CONFIG-09: from path');
  assert.equal(er.to, 'pdfjs-worker/pdf.worker.min.mjs', 'P0-CONFIG-10: to path');

  // ── Windows target ──
  assert.ok(build.win, 'win config exists');
  assert.ok(Array.isArray(build.win.target), 'win.target is array');
  assert.equal(build.win.target[0].target, 'nsis', 'P0-CONFIG-11: nsis target');
  assert.ok(build.win.target[0].arch.includes('x64'), 'P0-CONFIG-12: x64 arch');

  // ── NSIS ──
  assert.equal(build.nsis.oneClick, false, 'P0-CONFIG-13: oneClick false');
  assert.equal(build.nsis.allowToChangeInstallationDirectory, true, 'P0-CONFIG-14: allowToChange');

  // ── Forbidden config ──
  assert.equal(build.publish, undefined, 'P0-CONFIG-15: no publish/auto-update');
  assert.equal(build.asarUnpack, undefined, 'P0-CONFIG-09b: no asarUnpack for pdfjs-dist');

  const buildJson = JSON.stringify(build);
  assert.ok(!buildJson.includes('pymupdf4llm'), 'P0-CONFIG-18a: no PyMuPDF4LLM in build config');
  assert.ok(!buildJson.includes('marker'), 'P0-CONFIG-18b: no Marker in build config');
  assert.ok(!buildJson.includes('runtime-pack'), 'P0-CONFIG-17: no Runtime Pack');

  // ── Scripts check ──
  assert.equal(typeof pkg.scripts.build, 'string', 'P0-SCRIPT-01: build script exists');
  assert.ok(pkg.scripts.build.includes('build:electron'), 'P0-SCRIPT-02a: build includes electron');
  assert.ok(pkg.scripts.build.includes('build:renderer'), 'P0-SCRIPT-02b: build includes renderer');

  assert.equal(typeof pkg.scripts.package, 'string', 'P0-SCRIPT-03: package script exists');
  assert.ok(pkg.scripts.package.includes('build'), 'P0-SCRIPT-04: package calls build');

  assert.equal(typeof pkg.scripts['package:dir'], 'string', 'P0-SCRIPT-06: package:dir exists');
  assert.ok(pkg.scripts['package:dir'].includes('--dir'), 'P0-SCRIPT-08: package:dir uses --dir');

  // No pip/venv in scripts
  for (const [, script] of Object.entries(pkg.scripts)) {
    assert.ok(!String(script).includes('pip'), 'P0-SCRIPT-09a: no pip in ' + script);
    assert.ok(!String(script).includes('python'), 'P0-SCRIPT-09b: no python in ' + script);
    assert.ok(!String(script).includes('venv'), 'P0-SCRIPT-09c: no venv in ' + script);
  }

  // devDependency check
  assert.ok(pkg.devDependencies['electron-builder'], 'electron-builder in devDependencies');

  console.log('[PASS] packaging-electron-builder-config');
}

run();
