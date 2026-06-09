/**
 * Compiled Markdown Artifact Contract — Phase 4-2-G.
 *
 * Defines the structure for compiled Markdown artifacts
 * built from selected Vault scope, Query/Lint results, and Memory Trees.
 *
 * Key invariants:
 * - Derived artifact only (never auto-written to Vault)
 * - SourceRef / EvidenceRef preservation (relativePath-only)
 * - Artifact Preview first → user review → user saves
 * - No fabricated sources, no external database claims
 * - No real provider/embedding calls
 * - No subsequent phase features (writing, PPT, plugins)
 */
import type { SourceRef, EvidenceRef } from './local-qa.types';

export type CompileMode = 'topic' | 'literature_review' | 'methods' | 'results' | 'teaching' | 'summary';

export type CompileInputSource = 'selected_files' | 'query_result' | 'lint_report' | 'memory_tree';

export type ArtifactStatus = 'draft' | 'reviewed' | 'saved';

export interface CompiledMarkdownSection {
  readonly heading: string;
  readonly content: string;
  readonly sources: readonly SourceRef[];
  readonly evidence: readonly EvidenceRef[];
  readonly confidence: number;
  readonly isInsufficientEvidence: boolean;
}

export interface CompiledMarkdownArtifact {
  readonly id: string;
  readonly title: string;
  readonly mode: CompileMode;
  readonly source: CompileInputSource;
  readonly sections: readonly CompiledMarkdownSection[];
  readonly totalSources: number;
  readonly totalTokens: number;
  readonly status: ArtifactStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isMockArtifact: boolean;
}

export interface CompileRequest {
  readonly title: string;
  readonly mode: CompileMode;
  readonly source: CompileInputSource;
  readonly selectedFiles: readonly { relativePath: string; displayName: string }[];
  readonly queryResult?: { sources: readonly SourceRef[]; evidence: readonly EvidenceRef[] };
}

export interface CompileResult {
  readonly artifact: CompiledMarkdownArtifact | null;
  readonly status: 'success' | 'partial' | 'failed';
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly elapsedMs: number;
}

export interface CompileReport {
  readonly artifactId: string;
  readonly sectionsCompiled: number;
  readonly sectionsWithSources: number;
  readonly totalSources: number;
  readonly insufficientSections: number;
  readonly canSave: boolean;
}

export interface ArtifactWarning { readonly code: string; readonly message: string; }
export interface ArtifactError { readonly code: string; readonly message: string; }

let compileIdCounter = 0;
export function generateCompileId(): string {
  return `cm-${Date.now()}-${++compileIdCounter}`;
}

export function generateCompileReport(artifact: CompiledMarkdownArtifact): CompileReport {
  const withSources = artifact.sections.filter((s) => s.sources.length > 0).length;
  return {
    artifactId: artifact.id,
    sectionsCompiled: artifact.sections.length,
    sectionsWithSources: withSources,
    totalSources: artifact.totalSources,
    insufficientSections: artifact.sections.filter((s) => s.isInsufficientEvidence).length,
    canSave: artifact.status === 'reviewed',
  };
}
