export {};
/**
 * Phase 3-4-Lite-B R2-2: computeAvailableModes Lite behavior tests.
 * CJS mode �?imports ACTUAL service from compiled output.
 */
const assert = require('node:assert/strict');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', '..', 'dist-electron');
const probeMod = require(path.join(distDir, 'electron', 'services', 'engines', 'import', 'import-engine-capability-probe.service'));
const { computeAvailableModes } = probeMod;

// paperQuality always true
const m1 = computeAvailableModes(true);
assert.equal(m1.paper_quality, true, 'paperQuality=true with markitdown');

const m2 = computeAvailableModes(false);
assert.equal(m2.paper_quality, true, 'paperQuality=true without markitdown');

const m3 = computeAvailableModes(false, true);
assert.equal(m3.paper_quality, true, 'paperQuality=true with marker');

const m4 = computeAvailableModes(false, false);
assert.equal(m4.paper_quality, true, 'paperQuality=true without marker');

// paperQuality independent of paperEnhanced
assert.equal(m4.paper_enhanced, false, 'paperEnhanced=false');

// quick depends on markitdownAvailable
assert.equal(computeAvailableModes(true).quick, true, 'quick=true');
assert.equal(computeAvailableModes(false).quick, false, 'quick=false');

// paperEnhanced depends on markerAvailable
assert.equal(computeAvailableModes(false, true).paper_enhanced, true, 'enhanced=true');
assert.equal(computeAvailableModes(false, false).paper_enhanced, false, 'enhanced=false');

// ocr always false
assert.equal(computeAvailableModes(true, true).ocr, false, 'ocr=false');

// no path leaks
const json = JSON.stringify(computeAvailableModes(true, true));
assert.ok(!json.includes('python'), 'no Python path');
assert.ok(!json.includes('/usr/'), 'no Unix path');
assert.ok(!json.includes('C:\\'), 'no Windows path');

console.log('[PASS] import-available-modes-lite');


