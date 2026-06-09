/**
 * Artifact open / reveal types — Phase 3-2.
 *
 * Defines the IPC channel constants and result types for
 * the controlled artifact open/reveal operations.
 *
 * ⚠️  These are fixed-function channels only — no generic open/reveal.
 */

// ── IPC Channel constants ───────────────────────

export const ARTIFACT_OPEN_GENERATED_MARKDOWN_CHANNEL = 'artifact:open-generated-markdown';
export const ARTIFACT_REVEAL_GENERATED_MARKDOWN_CHANNEL = 'artifact:reveal-generated-markdown';
export const ARTIFACT_OPEN_EXPORT_ARTIFACT_CHANNEL = 'artifact:open-export-artifact';
export const ARTIFACT_REVEAL_EXPORT_ARTIFACT_CHANNEL = 'artifact:reveal-export-artifact';

// ── Result types ────────────────────────────────

export type ArtifactOpenErrorCode =
  | 'VAULT_NOT_OPEN'
  | 'INVALID_PATH'
  | 'OUTSIDE_ALLOWED_ROOT'
  | 'UNSUPPORTED_EXTENSION'
  | 'FILE_NOT_FOUND'
  | 'OPEN_FAILED'
  | 'INTERNAL_ERROR';

export interface ArtifactOpenSuccess {
  readonly ok: true;
}

export interface ArtifactOpenFailure {
  readonly ok: false;
  readonly errorCode: ArtifactOpenErrorCode;
  readonly message: string;
}

export type ArtifactOpenResult = ArtifactOpenSuccess | ArtifactOpenFailure;

// ── Renderer API ────────────────────────────────

export interface ScholaArtifactApi {
  readonly openGeneratedMarkdown: (vaultId: string, relativePath: string) => Promise<ArtifactOpenResult>;
  readonly revealGeneratedMarkdown: (vaultId: string, relativePath: string) => Promise<ArtifactOpenResult>;
  readonly openExportArtifact: (vaultId: string, relativePath: string) => Promise<ArtifactOpenResult>;
  readonly revealExportArtifact: (vaultId: string, relativePath: string) => Promise<ArtifactOpenResult>;
}
