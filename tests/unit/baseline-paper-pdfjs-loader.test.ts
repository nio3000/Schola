export {};
/**
 * Phase 3-4-Lite-B R2-2: pdfjs-dist loader static tests.
 * CJS mode.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../../package.json');
const ver = pkg.dependencies?.['pdfjs-dist'];
assert.ok(ver, 'pdfjs-dist in deps');
assert.ok(ver.startsWith('~5.7') || ver.startsWith('5.7'), 'version locked: ' + ver);

const legacyPdf = path.resolve(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
assert.ok(fs.existsSync(legacyPdf), 'legacy pdf.mjs exists');

const workerPath = path.resolve(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs');
assert.ok(fs.existsSync(workerPath), 'worker exists');

const cjsPath = path.resolve(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.js');
assert.ok(!fs.existsSync(cjsPath), 'no CJS build (v5+ ESM-only)');

const licensePath = path.resolve(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'LICENSE');
assert.ok(fs.existsSync(licensePath), 'LICENSE exists');

const pdfjsPkg = require('pdfjs-dist/package.json');
assert.equal(pdfjsPkg.license, 'Apache-2.0', 'Apache 2.0');

const hasPython = JSON.stringify(pdfjsPkg).toLowerCase().includes('python');
assert.ok(!hasPython, 'no Python dep');

const gypPath = path.resolve(__dirname, '..', '..', 'node_modules', 'pdfjs-dist', 'binding.gyp');
assert.ok(!fs.existsSync(gypPath), 'no native binding');

console.log('[PASS] baseline-paper-pdfjs-loader');


