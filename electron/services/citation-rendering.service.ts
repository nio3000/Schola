/**
 * CitationRenderingService — Phase 4-3-C.
 *
 * Renders citation markers from SourceRef and EvidenceRef into
 * deterministic, safe inline citation text and reference list entries.
 *
 * Key invariants:
 * - local-only: no external database lookup
 * - no fabricated references: no DOI/PMID/journal/author/year generation
 * - relativePath-only: citation targets never expose absolute paths
 * - deterministic: same input always produces same output
 * - safe placeholder format: "[Source: relative/path.md]"
 * - no provider call, no embedding call, no network
 * - no Vault write, no generic IPC
 * - no Phase 4-4 / Phase 5 entry
 */
import type {
  CitationMarker,
  CitationRenderResult,
  CitationRenderStyle,
  CitationRenderWarning,
  RenderedCitationEntry,
  WritingDraftArtifact,
  WritingDraftSection,
} from '../../src/lib/contracts/research-writing.types';
import type { SourceRef, EvidenceRef } from '../../src/lib/contracts/local-qa.types';

export class CitationRenderingService {
  /**
   * Render all citations from a draft artifact.
   * Produces both inline citations and a reference list.
   */
  renderCitations(
    draft: WritingDraftArtifact,
    style: CitationRenderStyle = 'both',
  ): CitationRenderResult {
    const warnings: CitationRenderWarning[] = [];
    const entries: RenderedCitationEntry[] = [];
    const seenSources = new Set<string>();

    for (const section of draft.sections) {
      for (const marker of section.citations) {
        const source = marker.sourceRef;

        // Deduplicate by source path
        if (seenSources.has(source.relativePath)) {
          warnings.push({
            code: 'DUPLICATE_SOURCE',
            message: `Duplicate source reference: ${source.relativePath}`,
          });
          continue;
        }
        seenSources.add(source.relativePath);

        if (!source.relativePath || source.relativePath.trim().length === 0) {
          warnings.push({
            code: 'MISSING_SOURCE',
            message: 'Citation marker references a source with empty relativePath.',
          });
          continue;
        }

        if (this.hasAbsolutePath(source.relativePath)) {
          warnings.push({
            code: 'ABSOLUTE_PATH_LEAK',
            message: `Source path appears to be absolute: ${source.relativePath}`,
          });
          continue;
        }

        const entry = this.buildRenderedEntry(source, entries.length + 1);
        entries.push(entry);
      }
    }

    if (entries.length === 0 && draft.sections.length > 0 && draft.allCitations.length === 0) {
      warnings.push({
        code: 'NO_CITATIONS',
        message: 'Draft has sections but no citation markers.',
      });
    }

    const inlineCitations = style !== 'reference_list'
      ? entries.map((e) => e.inlineText).join('; ')
      : '';
    const referenceList = style !== 'inline'
      ? entries.map((e) => e.referenceText).join('\n')
      : '';

    return {
      ok: warnings.length === 0,
      inlineCitations,
      referenceList: style === 'inline' ? '' : (referenceList || '(no references)'),
      entries,
      warnings,
      totalRendered: entries.length,
    };
  }

  /**
   * Render inline citation text for a single section.
   */
  renderSectionCitations(section: WritingDraftSection): string {
    if (section.citations.length === 0) {
      return '';
    }
    return section.citations
      .map((m) => this.buildInlineText(m.sourceRef))
      .join('; ');
  }

  /**
   * Build a reference list from a set of source refs.
   */
  buildReferenceList(sources: readonly SourceRef[]): string {
    if (sources.length === 0) {
      return '(no references)';
    }
    return sources
      .map((s, i) => `${i + 1}. [Source: ${s.relativePath}]`)
      .join('\n');
  }

  /**
   * Build a single rendered citation entry.
   */
  buildRenderedEntry(source: SourceRef, index: number): RenderedCitationEntry {
    const inlineText = this.buildInlineText(source);
    const referenceText = this.buildReferenceText(source, index);
    return {
      sourceRef: { ...source },
      inlineText,
      referenceText,
    };
  }

  /**
   * Build safe inline citation text.
   * Format: "[Source: relative/path.md]"
   */
  buildInlineText(source: SourceRef): string {
    const path = source.relativePath;
    const chunk = source.chunkIndex > 0 ? `#chunk-${source.chunkIndex}` : '';
    return `[Source: ${path}${chunk}]`;
  }

  /**
   * Build safe reference list entry text.
   * Format: "N. [Source: relative/path.md]"
   */
  buildReferenceText(source: SourceRef, index: number): string {
    const path = source.relativePath;
    const chunk = source.chunkIndex > 0 ? `#chunk-${source.chunkIndex}` : '';
    return `${index}. [Source: ${path}${chunk}]`;
  }

  /**
   * Render evidence-backed inline citation.
   * Format: "[Evidence: relative/path.md]"
   */
  buildEvidenceCitation(evidence: EvidenceRef): string {
    const path = evidence.source.relativePath;
    return `[Evidence: ${path}]`;
  }

  /**
   * Check if a path appears to be absolute (contains drive letter or UNC prefix).
   */
  private hasAbsolutePath(path: string): boolean {
    return path.includes(':\\') || path.includes('\\\\') || path.startsWith('/');
  }
}
