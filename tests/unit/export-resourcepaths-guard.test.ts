/**
 * Phase 3-1-C: Export resourcePaths guard test.
 *
 * Verifies that resourcePaths validation rejects:
 *  - Absolute paths
 *  - ../ escapes
 *  - Paths outside the vault
 *
 * Uses the actual validateResourcePaths from pandoc-args.
 */

import assert from 'node:assert/strict';
import { validateResourcePaths } from '../../electron/services/engines/export/pandoc-args';
import os from 'node:os';
import path from 'node:path';
import { mkdir, rm } from 'node:fs/promises';

async function run(): Promise<void> {
  const vaultRoot = path.join(os.tmpdir(), 'schola-export-rp-' + Date.now());
  await mkdir(vaultRoot, { recursive: true });

  try {
    // Valid vault-relative path
    assert.equal(validateResourcePaths(vaultRoot, ['images/figures/']), null,
      'Vault-internal path must pass validation');

    // Absolute path: rejected
    assert.ok(validateResourcePaths(vaultRoot, [vaultRoot + '/images']) !== null,
      'Absolute path must be rejected');

    // ../ escape: rejected
    assert.ok(validateResourcePaths(vaultRoot, ['../escape.txt']) !== null,
      'Path traversal must be rejected');

    // Deep ../ escape: rejected
    assert.ok(validateResourcePaths(vaultRoot, ['notes/../../escape.txt']) !== null,
      'Deep path traversal must be rejected');

    // Error message must not expose the path
    const err = validateResourcePaths(vaultRoot, ['../secret.txt']);
    assert.ok(err !== null);
    assert.ok(!err!.includes('secret'), 'Error must not expose actual path');
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
}

run().then(() => {
  console.log('[PASS] export-resourcepaths-guard');
}).catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
