export {};
/**
 * Phase 3-4-Lite-B R2-2: baselinePaperEngine contract tests.
 * CJS mode �?requires compiled JS from dist-electron/.
 */
const assert = require('node:assert/strict');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', '..', 'dist-electron');
const engineMod = require(path.join(distDir, 'electron', 'services', 'engines', 'import', 'baseline-paper.engine'));
const { baselinePaperEngine } = engineMod;

assert.equal(baselinePaperEngine.id, 'baseline_paper', 'id');
assert.deepStrictEqual(baselinePaperEngine.supportedFormats, ['pdf'], 'formats');
assert.ok(baselinePaperEngine.maxFileSizeBytes?.pdf !== undefined, 'maxSize');
assert.ok((baselinePaperEngine.maxFileSizeBytes?.pdf ?? 0) <= 50 * 1024 * 1024, 'maxSize<=50MB');
assert.equal(baselinePaperEngine.displayName, '内置论文导入', 'displayName');
assert.ok(baselinePaperEngine.version.length > 0, 'version');
assert.equal(typeof baselinePaperEngine.convert, 'function', 'convert');

const src = baselinePaperEngine.convert.toString();
assert.ok(!src.includes('child_process'), 'no-child_process');
assert.ok(!src.includes('execFile'), 'no-execFile');
assert.ok(!src.includes('spawn'), 'no-spawn');
assert.ok(!src.includes('python'), 'no-python');
assert.ok(!src.includes('pip'), 'no-pip');
assert.ok(!src.includes('fetch('), 'no-fetch');
assert.ok(!src.includes('http.'), 'no-http');

console.log('[PASS] baseline-paper-engine-contract');


