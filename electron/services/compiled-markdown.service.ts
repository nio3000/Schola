/**
 * CompiledMarkdownService — Phase 4-2-G.
 *
 * Compiles Markdown artifacts from:
 * - Selected files
 * - QueryResult
 * - LintReport
 * - MemoryTree
 *
 * Artifacts are DERIVED — never auto-written to Vault.
 * User review required before save. Save path selected by user.
 */
import type {
  CompiledMarkdownArtifact,
  CompiledMarkdownSection,
  CompileRequest,
  CompileResult,
  CompileMode,
} from '../../src/lib/contracts/compiled-markdown.types';
import { generateCompileId } from '../../src/lib/contracts/compiled-markdown.types';
import type { SourceRef } from '../../src/lib/contracts/local-qa.types';

export class CompiledMarkdownService {
  private artifacts: Map<string, CompiledMarkdownArtifact> = new Map();

  compile(request: CompileRequest): CompileResult {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!request.title) {
      return { artifact: null, status: 'failed',
        errors: ['Title is required'], warnings: [], elapsedMs: Date.now() - startTime };
    }

    const sections = this.buildSections(request);
    const now = new Date().toISOString();

    const artifact: CompiledMarkdownArtifact = {
      id: generateCompileId(),
      title: request.title,
      mode: request.mode,
      source: request.source,
      sections,
      totalSources: sections.reduce((s, sec) => s + sec.sources.length, 0),
      totalTokens: sections.length * 100,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      isMockArtifact: true,
    };

    this.artifacts.set(artifact.id, artifact);

    return {
      artifact,
      status: warnings.length > 0 ? 'partial' : 'success',
      errors,
      warnings,
      elapsedMs: Date.now() - startTime,
    };
  }

  review(artifactId: string): { ok: boolean; reason?: string } {
    const a = this.artifacts.get(artifactId);
    if (!a) return { ok: false, reason: 'Artifact not found' };
    const updated = { ...a, status: 'reviewed' as const, updatedAt: new Date().toISOString() };
    this.artifacts.set(artifactId, updated);
    return { ok: true };
  }

  getArtifact(id: string): CompiledMarkdownArtifact | null {
    return this.artifacts.get(id) ?? null;
  }

  listArtifacts(): readonly CompiledMarkdownArtifact[] {
    return Array.from(this.artifacts.values());
  }

  clear(): void { this.artifacts.clear(); }

  // ── Section Builder ─────────────────────────────

  private buildSections(request: CompileRequest): CompiledMarkdownSection[] {
    const sections: CompiledMarkdownSection[] = [];
    const sources = request.queryResult?.sources ?? [];

    // Section from selected files
    if (request.selectedFiles.length > 0) {
      sections.push({
        heading: `Source Files (${request.selectedFiles.length})`,
        content: request.selectedFiles.map((f) => `- ${f.displayName}`).join('\n'),
        sources: request.selectedFiles.map((f) => ({
          relativePath: f.relativePath, chunkIndex: 0, headingPath: [], score: 1,
        })),
        evidence: [],
        confidence: 1,
        isInsufficientEvidence: false,
      });
    }

    // Section from query results
    if (sources.length > 0) {
      sections.push(this.buildSourceSection(request.mode, sources));
    } else if (request.source === 'query_result') {
      sections.push({
        heading: 'Query Results',
        content: 'No relevant sources found.',
        sources: [],
        evidence: [],
        confidence: 0,
        isInsufficientEvidence: true,
      });
    }

    // Section from lint report (skeleton)
    if (request.source === 'lint_report') {
      sections.push({
        heading: 'Lint Findings',
        content: 'Lint report summary — see lint workflow for details.',
        sources: [],
        evidence: [],
        confidence: 0.5,
        isInsufficientEvidence: false,
      });
    }

    // Section from memory tree (skeleton)
    if (request.source === 'memory_tree') {
      sections.push({
        heading: 'Memory Tree Summary',
        content: 'Memory tree nodes compiled from your Vault knowledge.',
        sources: [],
        evidence: [],
        confidence: 0.7,
        isInsufficientEvidence: false,
      });
    }

    return sections;
  }

  private buildSourceSection(mode: CompileMode, sources: readonly SourceRef[]): CompiledMarkdownSection {
    const heading = mode === 'literature_review' ? 'Literature Review' :
      mode === 'methods' ? 'Methods' :
      mode === 'results' ? 'Results' :
      mode === 'teaching' ? 'Teaching Notes' : 'Compiled Content';

    const content = sources.map((s, i) => {
      const h = s.headingPath.length > 0 ? ` (${s.headingPath.join(' > ')})` : '';
      return `${i + 1}. ${s.relativePath}${h} [relevance: ${s.score.toFixed(2)}]`;
    }).join('\n');

    return {
      heading,
      content,
      sources: sources.map((s) => ({ ...s })),
      evidence: [],
      confidence: sources.length > 0 ? 0.8 : 0,
      isInsufficientEvidence: sources.length === 0,
    };
  }
}
