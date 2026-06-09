/**
 * Export artifact metadata — Phase 3-1-A.
 *
 * Stored at .schola/metadata/exports/export_xxx.json alongside the
 * export artifact in _exports/.
 *
 * ⚠️  ALL path fields use *RelativePath naming (E-2 C3 frozen).
 *     System absolute paths are never persisted.
 */

import type { ExportEngine, ExportFormat, PandocOptions } from './export.types';

export interface ExportArtifactMetadata {
  readonly schemaVersion: 1;
  readonly exportId: string;
  readonly vaultId: string;
  readonly jobId: string;

  /** Vault-relative path to the source Markdown (E-2 C3 frozen). */
  readonly sourceMarkdownRelativePath: string;

  /** Vault-relative path to the export artifact inside _exports/ (E-2 C3 frozen). */
  readonly outputRelativePath: string;

  /** Vault-relative path to this metadata JSON itself. */
  readonly metadataRelativePath: string;

  readonly targetFormat: ExportFormat;
  readonly engine: ExportEngine;
  readonly engineVersion: string;
  readonly pandocOptions: PandocOptions;

  readonly warnings: readonly {
    readonly code: string;
    readonly message: string;
    readonly format: ExportFormat;
  }[];

  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly recoverable: boolean;
  } | null;

  readonly createdAt: string;   // ISO 8601
  readonly durationMs: number;

  // ⚠️  sourceMarkdownPath / outputPath intentionally renamed
  //     to *RelativePath (E-2 C3 / E-3 C2 frozen).
}
