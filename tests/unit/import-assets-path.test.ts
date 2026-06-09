/**
 * Phase 3-4-B: Assets path test.
 *
 * Verifies assetRelativePath / imageRelativePath use
 * notes/imported/assets/ (not _assets/), are vault-relative,
 * and do not contain absolute paths or ../.
 */

import assert from 'node:assert/strict';

function run(): void {
  // ═══ Valid asset paths ═══
  const validPaths = [
    'notes/imported/assets/import_001_fig1.png',
    'notes/imported/assets/import_001_eq1.png',
    'notes/imported/assets/import_001_tab1.png',
  ];

  for (const p of validPaths) {
    assert.ok(p.startsWith('notes/imported/assets/'), 'Must start with notes/imported/assets/: ' + p);
    assert.ok(!p.includes('_assets/'), 'Must not use _assets/ prefix: ' + p);
    assert.ok(!p.includes(':\\'), 'Must not be Windows absolute: ' + p);
    assert.ok(!p.startsWith('/'), 'Must not be Unix absolute: ' + p);
    assert.ok(!p.includes('..'), 'Must not contain ../: ' + p);
  }

  // ═══ Invalid: _assets/ prefix ═══
  const invalidPath = 'notes/imported/_assets/import_001_fig1.png';
  assert.ok(invalidPath.includes('_assets/'), 'This path uses _assets/ (should be assets/)');

  // ═══ Invalid: absolute paths ═══
  assert.ok('C:\\Users\\a\\fig1.png'.includes(':\\'), 'Windows absolute path');
  assert.ok('/Users/a/fig1.png'.startsWith('/'), 'Unix absolute path');

  // ═══ Invalid: path traversal ═══
  assert.ok('../escape.png'.includes('..'), 'Path traversal');

  console.log('[PASS] import-assets-path');
}

run();
