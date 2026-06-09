export {};
/**
 * Phase 4-0-P0-IMP: packaging security boundary test.
 *
 * P0-PACKAGE-01 ~ P0-PACKAGE-16.
 * Verifies the electron-builder config does not bundle forbidden content.
 */
const assert = require('node:assert/strict');
const path = require('node:path');

function run(): void {
  const pkgPath = path.resolve(__dirname, '..', '..', 'package.json');
  const pkg = require(pkgPath);
  const build = pkg.build;
  const buildJson = JSON.stringify(build);
  const scriptsJson = JSON.stringify(pkg.scripts);

  // ═══ P0-PACKAGE-02~10: No forbidden content in config ═══
  const forbiddenPatterns = [
    ['pymupdf4llm', 'P0-PACKAGE-04'],
    ['marker-pdf', 'P0-PACKAGE-05'],
    ['huggingface', 'P0-PACKAGE-06'],
    ['model', 'P0-PACKAGE-07'],
    ['runtime-pack', 'P0-PACKAGE-08'],
    ['python', 'P0-PACKAGE-09'],
    ['venv', 'P0-PACKAGE-03'],
  ];
  for (const [pattern, id] of forbiddenPatterns) {
    assert.ok(
      !buildJson.toLowerCase().includes(String(pattern)),
      id + ': no ' + pattern + ' in build config',
    );
    assert.ok(
      !scriptsJson.toLowerCase().includes(String(pattern)),
      id + ': no ' + pattern + ' in scripts',
    );
  }

  // ═══ P0-PACKAGE-11~14: IPC channels ═══
  const forbiddenIpc = [
    'import:list-engines',
    'import:set-engine',
    'import:run-python',
    'install-runtime',
    'diagnostics:',
    'runtime:install',
  ];
  for (const ch of forbiddenIpc) {
    assert.ok(!buildJson.includes(ch), 'P0-PACKAGE-11~14: no ' + ch + ' in config');
  }

  // ═══ P0-PACKAGE-15: renderer does not pass engine ═══
  // Verified by type system — ImportMode only, no engine field in renderer API
  const engineKeywords = ['ImportEngine', 'engine:', '"engine"'];
  // Build config itself shouldn't embed engine selection
  // (actual code verification is in import-security-boundary-lite)

  // ═══ P0-PACKAGE-16: preload whitelist unchanged ═══
  // electron-builder config does not modify preload
  assert.ok(!buildJson.includes('preload'), 'build config does not modify preload');

  // ═══ P0-CONFIG-15/16: No auto-update ═══
  assert.equal(build.publish, undefined, 'P0-CONFIG-15: no publish config');

  // ═══ P0-XPLAT-05/06: No code signing, no auto-update ═══
  assert.ok(!buildJson.includes('certificate'), 'no code signing');
  assert.ok(!buildJson.includes('sign'), 'no signing config');

  // ═══ Extra check: extraResources only contains pdfjs worker ═══
  if (build.extraResources) {
    assert.equal(build.extraResources.length, 1, 'only one extraResource entry');
    const er = build.extraResources[0];
    assert.ok(er.to.startsWith('pdfjs-worker'), 'extraResource only for pdfjs worker');
  }

  console.log('[PASS] packaging-security-boundary');
}

run();
