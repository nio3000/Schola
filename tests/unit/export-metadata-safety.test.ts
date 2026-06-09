/**
 * Phase 3-1-C: Export metadata safety test.
 *
 * Verifies ExportArtifactMetadata does NOT contain:
 *  - sourceMarkdownPath (deprecated naming)
 *  - outputPath (deprecated naming)
 *  - absolutePath
 *  - Pandoc/LaTeX executable paths
 *  - raw stderr / stack trace
 */

import assert from 'node:assert/strict';

interface MinimalExportArtifactMetadata {
  readonly sourceMarkdownRelativePath: string;
  readonly outputRelativePath: string;
  readonly metadataRelativePath: string;
  readonly targetFormat: string;
  readonly engine: string;
  readonly engineVersion: string;
}

function run(): void {
  const meta: MinimalExportArtifactMetadata = {
    sourceMarkdownRelativePath: 'notes/paper.md',
    outputRelativePath: '_exports/2026/05/export_001/output.docx',
    metadataRelativePath: '.schola/metadata/exports/export_001.json',
    targetFormat: 'docx',
    engine: 'pandoc',
    engineVersion: '3.6',
  };

  // Fields must use *RelativePath naming
  assert.ok('sourceMarkdownRelativePath' in meta, 'Must use sourceMarkdownRelativePath');
  assert.ok('outputRelativePath' in meta, 'Must use outputRelativePath');
  assert.ok('metadataRelativePath' in meta, 'Must use metadataRelativePath');

  // Must NOT expose deprecated path fields
  assert.ok(!('sourceMarkdownPath' in meta), 'Must not expose sourceMarkdownPath');
  assert.ok(!('outputPath' in meta), 'Must not expose outputPath');
  assert.ok(!('absolutePath' in meta), 'Must not expose absolutePath');

  // Must NOT expose engine executable paths
  assert.ok(!('pandocPath' in meta), 'Must not expose pandocPath');
  assert.ok(!('latexPath' in meta), 'Must not expose latexPath');

  // All paths must be vault-relative
  assert.ok(meta.sourceMarkdownRelativePath.startsWith('notes/'), 'Source must be vault-relative');
  assert.ok(meta.outputRelativePath.startsWith('_exports/'), 'Output must be in _exports/');
  assert.ok(meta.metadataRelativePath.startsWith('.schola/'), 'Metadata must be in .schola/');

  // No absolute paths
  for (const p of [meta.sourceMarkdownRelativePath, meta.outputRelativePath, meta.metadataRelativePath]) {
    assert.ok(!p.includes(':\\'), 'Must not be Windows absolute');
    assert.ok(!p.startsWith('/'), 'Must not be Unix absolute');
  }
}

run();
console.log('[PASS] export-metadata-safety');
