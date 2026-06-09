/**
 * Phase 3-4-B: ImportCompanion backward compatibility test.
 *
 * Verifies old companion JSON (Phase 3-1-A) is still valid,
 * new optional fields can be added without breaking schemaVersion 1.
 */

import assert from 'node:assert/strict';

// Minimal companion matching Phase 3-1-A + Phase 3-4-B optional fields

interface OldCompanion {
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
  readonly createdAt: string;
}

interface NewCompanion extends OldCompanion {
  readonly importMode?: string;
  readonly pageCount?: number;
  readonly confidence?: {
    readonly text: string;
    readonly equations: string;
  };
}

function run(): void {
  // Old companion (Phase 3-1-A) — must be valid
  const old: OldCompanion = {
    schemaVersion: 1,
    companionId: 'import_001',
    vaultId: 'v1',
    jobId: 'import_001',
    markdownRelativePath: 'notes/imported/paper.md',
    attachmentRelativePath: 'attachments/imports/import_001_paper.pdf',
    sourceFormat: 'pdf',
    sourceFileName: 'paper.pdf',
    sourceFileHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    engine: 'markitdown',
    engineVersion: '0.5.0',
    quality: 'full',
    createdAt: '2026-05-18T10:00:00.000Z',
  };

  assert.equal(old.schemaVersion, 1);
  assert.equal(old.quality, 'full');

  // New companion with optional Phase 3-4-B fields
  const neu: NewCompanion = {
    ...old,
    importMode: 'quick',
    pageCount: 12,
    confidence: { text: 'high', equations: 'medium' },
  };

  assert.equal(neu.schemaVersion, 1, 'schemaVersion must remain 1');
  assert.equal(neu.importMode, 'quick');
  assert.equal(neu.pageCount, 12);

  // Old companion without optional fields is still valid
  const missingOptionals: NewCompanion = {
    ...old,
    // importMode, pageCount, confidence intentionally omitted
  };
  assert.equal(missingOptionals.schemaVersion, 1);
  assert.equal(missingOptionals.importMode, undefined);

  console.log('[PASS] import-companion-compat');
}

run();
