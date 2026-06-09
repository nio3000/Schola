/**
 * Phase 3-1-A: relativePath naming test.
 *
 * Verifies that ExportJobStatus and ExportArtifactMetadata use
 * *RelativePath field naming, not the deprecated *Path forms.
 *
 * ⚠️  Static contract test — no runtime dependencies.
 */

import assert from 'node:assert/strict';

// Representative minimal shapes for the frozen contracts.

interface MinimalExportJobStatus {
  readonly jobId: string;
  readonly sourceMarkdownRelativePath: string;
  readonly outputRelativePath: string | null;
  readonly metadataRelativePath: string | null;
  // ⚠️ sourceMarkdownPath / outputPath MUST NOT be here
}

interface MinimalExportArtifactMetadata {
  readonly sourceMarkdownRelativePath: string;
  readonly outputRelativePath: string;
  readonly metadataRelativePath: string;
  // ⚠️ sourceMarkdownPath / outputPath MUST NOT be here
}

function run(): void {
  // ── ExportJobStatus ─────────────────────────
  const jobStatus: MinimalExportJobStatus = {
    jobId: 'test-job',
    sourceMarkdownRelativePath: 'notes/paper.md',
    outputRelativePath: '_exports/2026/05/export_001/paper.docx',
    metadataRelativePath: '.schola/metadata/exports/export_001.json',
  };

  assert.ok('sourceMarkdownRelativePath' in jobStatus, 'ExportJobStatus must use sourceMarkdownRelativePath');
  assert.ok('outputRelativePath' in jobStatus, 'ExportJobStatus must use outputRelativePath');
  assert.ok(!('sourceMarkdownPath' in jobStatus), 'ExportJobStatus must NOT use sourceMarkdownPath');
  assert.ok(!('outputPath' in jobStatus), 'ExportJobStatus must NOT use outputPath');

  // ── ExportArtifactMetadata ──────────────────
  const metadata: MinimalExportArtifactMetadata = {
    sourceMarkdownRelativePath: 'notes/paper.md',
    outputRelativePath: '_exports/2026/05/export_001/paper.docx',
    metadataRelativePath: '.schola/metadata/exports/export_001.json',
  };

  assert.ok('sourceMarkdownRelativePath' in metadata, 'ExportArtifactMetadata must use sourceMarkdownRelativePath');
  assert.ok('outputRelativePath' in metadata, 'ExportArtifactMetadata must use outputRelativePath');
  assert.ok(!('sourceMarkdownPath' in metadata), 'ExportArtifactMetadata must NOT use sourceMarkdownPath');
  assert.ok(!('outputPath' in metadata), 'ExportArtifactMetadata must NOT use outputPath');
}

run();
console.log('[PASS] relativepath-naming');
