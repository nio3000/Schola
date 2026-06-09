/**
 * Phase 3-1-A: resourcePaths guard test.
 *
 * Verifies that the PandocOptions.resourcePaths field is documented
 * with vault-relative path constraints via JSDoc.
 *
 * ⚠️  Static contract test.
 *     Runtime validation (resolveVaultPath per-item) will be tested
 *     in Phase 3-1-C when the Pandoc engine is implemented.
 *     See test boundary T-RP-01–07 in E-4.
 */

import assert from 'node:assert/strict';
import { resolveVaultPath } from '../../electron/security/path-guard';
import os from 'node:os';
import path from 'node:path';
import { mkdir, rm } from 'node:fs/promises';

/**
 * Phase 3-1-A: resolveVaultPath already refuses absolute paths
 * and `../` escapes.  We verify these guards here since they are
 * the foundation for the resourcePaths whitelist validation that
 * Phase 3-1-C will layer on top.
 */
async function run(): Promise<void> {
  const vaultRoot = path.join(os.tmpdir(), `schola-respath-${Date.now()}`);
  await mkdir(vaultRoot, { recursive: true });

  try {
    // ── Vault-internal relative path: must resolve ──
    const resolved = resolveVaultPath(vaultRoot, 'images/figures/');
    assert.ok(resolved.startsWith(vaultRoot), 'Vault-internal path must resolve inside vault');

    // ── Absolute path: must throw ──────────────
    assert.throws(
      () => resolveVaultPath(vaultRoot, path.join(vaultRoot, 'images')),
      /absolute/,
      'Absolute path must be rejected',
    );

    // ── ../ escape: must throw ──────────────────
    assert.throws(
      () => resolveVaultPath(vaultRoot, '../escape.txt'),
      /escapes/,
      'Path traversal must be rejected',
    );

    // ── Deep ../ escape: must throw ─────────────
    assert.throws(
      () => resolveVaultPath(vaultRoot, 'notes/../../escape.txt'),
      /escapes/,
      'Deep path traversal must be rejected',
    );
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
}

run().then(() => {
  console.log('[PASS] resourcepaths-guard');
}).catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
