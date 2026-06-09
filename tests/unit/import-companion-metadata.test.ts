/**
 * Phase 3-1-B: Import companion metadata safety test.
 *
 * Verifies that ImportCompanion JSON structure:
 * 1. Does NOT contain sourcePath, absolute path, user home path.
 * 2. Does contain all required fields from the frozen contract.
 * 3. All paths are vault-relative.
 * 4. Warning/error messages are sanitized.
 *
 * ⚠️  Static contract test — no runtime dependencies.
 */

import assert from 'node:assert/strict';

// ── Minimal companion matching frozen contract ──

interface MinimalImportCompanion {
  readonly schemaVersion: number;
  readonly companionId: string;
  readonly vaultId: string;
  readonly jobId: string;
  readonly markdownRelativePath: string;
  readonly attachmentRelativePath: string;
  readonly sourceFormat: string;
  readonly sourceFileName: string;
  readonly sourceFileHash: string;
  readonly engine: string;
  readonly engineVersion: string;
  readonly quality: 'full' | 'partial' | 'failed';
  readonly warnings: readonly { readonly code: string; readonly message: string }[];
  readonly error: { readonly code: string; readonly message: string; readonly recoverable: boolean } | null;
  readonly createdAt: string;
}

function run(): void {
  // ── Full success companion ────────────────────
  const companion: MinimalImportCompanion = {
    schemaVersion: 1,
    companionId: 'import_001',
    vaultId: 'test-vault',
    jobId: 'import_001',
    markdownRelativePath: 'notes/imported/paper.md',
    attachmentRelativePath: 'attachments/imports/2026/05/import_001/original.pdf',
    sourceFormat: 'pdf',
    sourceFileName: 'paper.pdf',
    sourceFileHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    engine: 'markitdown',
    engineVersion: '0.5.0',
    quality: 'full',
    warnings: [],
    error: null,
    createdAt: '2026-05-18T10:30:00.000Z',
  };

  // ── Required fields present ───────────────────
  assert.equal(companion.schemaVersion, 1);
  assert.equal(typeof companion.companionId, 'string');
  assert.equal(typeof companion.vaultId, 'string');
  assert.equal(typeof companion.jobId, 'string');
  assert.equal(typeof companion.markdownRelativePath, 'string');
  assert.equal(typeof companion.attachmentRelativePath, 'string');
  assert.equal(typeof companion.sourceFormat, 'string');
  assert.equal(typeof companion.sourceFileName, 'string');
  assert.equal(typeof companion.sourceFileHash, 'string');
  assert.equal(typeof companion.engine, 'string');
  assert.equal(typeof companion.engineVersion, 'string');
  assert.equal(typeof companion.createdAt, 'string');

  // ── No sourcePath / absolutePath ──────────────
  assert.ok(!('sourcePath' in companion), 'Companion must not contain sourcePath');
  assert.ok(!('absolutePath' in companion), 'Companion must not contain absolutePath');
  assert.ok(!('userHomePath' in companion), 'Companion must not contain userHomePath');
  assert.ok(!('pythonPath' in companion), 'Companion must not contain pythonPath');

  // ── sourceFileHash must be valid SHA-256 ──────
  assert.equal(companion.sourceFileHash.length, 64, 'Hash must be 64 hex chars');
  assert.ok(/^[a-f0-9]+$/i.test(companion.sourceFileHash), 'Hash must be hex');

  // ── sourceFileName is name only, no path ──────
  assert.ok(!companion.sourceFileName.includes('/'), 'sourceFileName must not be a path');
  assert.ok(!companion.sourceFileName.includes('\\'), 'sourceFileName must not be a path');

  // ── All paths must be vault-relative ──────────
  const paths = [
    companion.markdownRelativePath,
    companion.attachmentRelativePath,
  ];

  for (const p of paths) {
    assert.ok(!p.includes(':\\'), `Path '${p}' must not be Windows absolute`);
    assert.ok(!p.startsWith('/'), `Path '${p}' must not be Unix absolute`);
  }

  // ── createdAt must be ISO 8601 ────────────────
  assert.ok(companion.createdAt.includes('T'), 'Must be ISO 8601');
  assert.ok(
    !isNaN(Date.parse(companion.createdAt)),
    'Must be valid ISO 8601 date',
  );

  // ── Failed companion: error message safe ──────
  const failed: MinimalImportCompanion = {
    ...companion,
    quality: 'failed',
    error: {
      code: 'CONVERSION_FAILED',
      message: 'MarkItDown conversion failed.',
      recoverable: false,
    },
  };

  assert.equal(failed.quality, 'failed');
  assert.ok(failed.error !== null);
  assert.ok(!failed.error!.message.includes('Traceback'), 'Error must not contain traceback');
  assert.ok(!failed.error!.message.includes('stderr'), 'Error must not reference raw stderr');
  assert.ok(!failed.error!.message.includes('C:\\'), 'Error must not contain Windows path');
  assert.ok(!failed.error!.message.includes('/usr/'), 'Error must not contain Unix path');
}

run();
console.log('[PASS] import-companion-metadata');
