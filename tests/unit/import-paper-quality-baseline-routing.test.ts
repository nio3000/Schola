export {};
/**
 * Phase 3-4-Lite-B R2-2: paper_quality routing tests.
 * CJS mode.
 */
const assert = require('node:assert/strict');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', '..', 'dist-electron');
const engineMod = require(path.join(distDir, 'electron', 'services', 'engines', 'import', 'baseline-paper.engine'));
const { baselinePaperEngine } = engineMod;
const registryMod = require(path.join(distDir, 'src', 'lib', 'contracts', 'engine-registry.types'));
const { CORE_IMPORT_ENGINES, DEFAULT_IMPORT_ENGINE } = registryMod;

assert.ok(baselinePaperEngine, 'engine exists');
assert.equal(baselinePaperEngine.id, 'baseline_paper', 'engine id');

const profile = CORE_IMPORT_ENGINES['baseline_paper'];
assert.ok(profile, 'baseline_paper in CORE_IMPORT_ENGINES');
assert.equal(profile.mode, 'paper_quality', 'mode=paper_quality');
assert.equal(profile.requiresExternalRuntime, false, 'requiresExternalRuntime=false');

const pymuProfile = CORE_IMPORT_ENGINES['pymupdf4llm'];
assert.ok(pymuProfile, 'pymupdf4llm profile exists');
assert.notEqual(pymuProfile.mode, 'paper_quality', 'pymupdf4llm NOT paper_quality');

assert.equal(DEFAULT_IMPORT_ENGINE, 'markitdown', 'DEFAULT=markitdown');
assert.deepStrictEqual(baselinePaperEngine.supportedFormats, ['pdf'], 'PDF-only');
assert.ok(baselinePaperEngine.version.length > 0, 'version non-empty');

console.log('[PASS] import-paper-quality-baseline-routing');


