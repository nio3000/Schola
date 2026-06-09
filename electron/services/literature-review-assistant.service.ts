/**
 * LiteratureReviewAssistantService — Phase 4-3-F.
 *
 * Generates deterministic mock drafts for literature reviews using only
 * user-selected Vault sources. Produces themed, source-backed, evidence-backed
 * draft artifacts with gap/limitation statements marked as inferential.
 *
 * Integrates with DraftGeneratorService, CitationRenderingService,
 * ReferenceGuardService, and UnsupportedClaimGuard.
 *
 * Key invariants:
 * - Vault-only / selected-sources-only: no external database lookup
 * - source-backed / evidence-backed: every claim cites SourceRef/EvidenceRef
 * - draft-only: status always 'draft', never 'final'/'submitted'/'published'
 * - gap statements are marked as inferential / draft
 * - no fabricated references (no fake DOI/PMID/journal metadata)
 * - no provider call, no embedding call, no network
 * - no Vault write, no generic IPC
 * - no external database claim (PubMed, Crossref, OpenAlex, Google Scholar)
 * - no automatic literature discovery or journal recommendation
 * - no Phase 4-3-G, Phase 4-4, or Phase 5 entry
 */
import type {
  LiteratureReviewMode,
  LiteratureReviewDraftRequest,
  LiteratureReviewDraftResult,
  LiteratureReviewDraftReport,
  LiteratureReviewWarning,
  LiteratureReviewError,
  LiteratureReviewTheme,
  LiteratureReviewGroup,
  WritingDraftArtifact,
  WritingSourcePack,
  UnsupportedClaimGuardResult,
  CitationRenderResult,
  ReferenceGuardResult,
} from '../../src/lib/contracts/research-writing.types';
import {
  generateWritingDraftId,
} from '../../src/lib/contracts/research-writing.types';
import type { SourceRef, EvidenceRef } from '../../src/lib/contracts/local-qa.types';
import { DraftGeneratorService } from './draft-generator.service';
import type { DraftGenerationRequest } from '../../src/lib/contracts/research-writing.types';
import { CitationRenderingService } from './citation-rendering.service';
import { ReferenceGuardService } from './reference-guard.service';

// ── Sections ───────────────────────────────────────────

const LITERATURE_REVIEW_SECTIONS = [
  'Introduction',
  'Thematic Analysis',
  'Related Work',
  'Gaps and Limitations',
  'Conclusion',
] as const;

// ── LiteratureReviewAssistantService ─────────────────────

export class LiteratureReviewAssistantService {
  private readonly draftGenerator = new DraftGeneratorService();
  private readonly citationRenderer = new CitationRenderingService();
  private readonly referenceGuard = new ReferenceGuardService();

  /**
   * Generate a literature review draft.
   * Produces a deterministic mock draft from user-selected Vault sources only.
   */
  generateLiteratureReviewDraft(
    request: LiteratureReviewDraftRequest,
  ): LiteratureReviewDraftResult {
    const warnings: LiteratureReviewWarning[] = [];
    const errors: LiteratureReviewError[] = [];
    const generatedAt = new Date().toISOString();
    const { mode } = request;

    // Validate inputs
    const inputErrors = this.validateLiteratureReviewInputs(request);
    if (inputErrors.length > 0) {
      return this.failResult(mode, generatedAt, [], inputErrors);
    }

    // Validate source pack
    if (!request.sourcePack) {
      return this.failResult(
        mode, generatedAt, [],
        [{ code: 'MISSING_SOURCE_PACK', message: 'Source pack is required.' }],
      );
    }

    const { sourcePack } = request;
    const sources = sourcePack.sources;
    const evidence = sourcePack.evidence;

    // Context confirmation
    if (!request.contextConfirmationSummary?.trim()) {
      return this.failResult(
        mode, generatedAt, [],
        [{ code: 'NO_CONTEXT_CONFIRMATION', message: 'Context confirmation is required.' }],
      );
    }

    // Selected sources required — no selected sources → insufficient_evidence
    if (sources.length === 0) {
      return this.failResult(
        mode, generatedAt, [],
        [{ code: 'INSUFFICIENT_EVIDENCE', message: 'No selected sources available for literature review.' }],
      );
    }

    // Evidence warning (non-blocking)
    if (evidence.length === 0) {
      warnings.push({
        code: 'NO_EVIDENCE',
        message: 'No evidence refs provided for literature review.',
      });
    }

    // Handle duplicate sources
    const duplicateCount = this.countDuplicates(sources);
    if (duplicateCount > 0) {
      warnings.push({
        code: 'DUPLICATE_SOURCES',
        message: `${duplicateCount} duplicate source(s) detected. Using unique sources only.`,
      });
    }

    // Check for missing metadata
    const missingMetadataCount = this.countMissingMetadata(sources);
    if (missingMetadataCount > 0) {
      warnings.push({
        code: 'MISSING_METADATA',
        message: `${missingMetadataCount} source(s) have incomplete metadata (missing author, title, or year).`,
      });
    }

    // Build draft via DraftGeneratorService
    const draftRequest: DraftGenerationRequest = {
      taskType: 'literature_review_draft',
      sourcePack,
      contextConfirmationSummary: request.contextConfirmationSummary,
      mode: 'mock',
      title: request.title,
    };

    const genResult = this.draftGenerator.generateDraft(draftRequest);

    if (!genResult.draft) {
      return this.failResult(
        mode, generatedAt, warnings,
        [{ code: 'DRAFT_GENERATION_FAILED', message: 'Draft generation failed.' }],
      );
    }

    // Forward errors from DraftGenerator as warnings
    if (!genResult.ok) {
      for (const err of genResult.errors) {
        warnings.push({ code: err.code, message: err.message });
      }
    }

    // Build literature-review-specific draft
    const draft = this.buildLiteratureReviewDraft(
      genResult.draft,
      sources,
      evidence,
    );

    // Ensure all sections carry SourceRef and EvidenceRef
    this.verifySourceBacking(draft, warnings);

    // Run unsupported claim guard
    const guardResult = this.draftGenerator.buildUnsupportedClaimGuard(draft);

    // Run citation rendering
    let renderResult: CitationRenderResult | null = null;
    try {
      renderResult = this.citationRenderer.renderCitations(draft);
    } catch {
      warnings.push({ code: 'CITATION_RENDER_FAILED', message: 'Citation rendering encountered an error.' });
    }

    // Run reference guard
    let referenceResult: ReferenceGuardResult | null = null;
    try {
      referenceResult = this.referenceGuard.guardReferences(draft);
    } catch {
      warnings.push({ code: 'REFERENCE_GUARD_FAILED', message: 'Reference guard encountered an error.' });
    }

    // Source grouping and theme extraction
    const groups = this.groupSourcesByTheme(sources, evidence);
    const themes = this.extractThemesFromGroups(groups);

    // Build report
    const report = this.buildLiteratureReviewReport(
      mode,
      sources,
      evidence,
      draft,
      guardResult,
      renderResult,
      referenceResult,
      warnings,
      duplicateCount,
      missingMetadataCount,
      generatedAt,
    );

    return {
      ok: true,
      draft,
      report,
      warnings,
      errors,
      mode,
      guardResult,
      renderResult,
      referenceResult,
    };
  }

  /**
   * Validate literature review input constraints.
   * Returns blocking errors (no selected sources, invalid mode, etc.).
   */
  validateLiteratureReviewInputs(
    request: LiteratureReviewDraftRequest,
  ): LiteratureReviewError[] {
    const errors: LiteratureReviewError[] = [];

    // Mode must be vault_only or selected_sources_only
    if (!request.mode || !['vault_only', 'selected_sources_only'].includes(request.mode)) {
      errors.push({
        code: 'INVALID_MODE',
        message: 'Literature review mode must be vault_only or selected_sources_only.',
        details: `Received: ${String(request.mode)}`,
      });
    }

    // Source pack must exist (contents validated separately in main flow)
    if (!request.sourcePack) {
      errors.push({
        code: 'MISSING_SOURCE_PACK',
        message: 'Source pack is required to generate a literature review.',
      });
    }

    return errors;
  }

  /**
   * Group sources into thematic categories based on heading paths and content.
   * Only uses selected Vault sources — no external clustering.
   */
  groupSourcesByTheme(
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ): LiteratureReviewGroup[] {
    if (sources.length === 0) return [];

    const uniqueSources = this.deduplicateSources(sources);

    // Deterministic grouping based on heading paths
    const groups = new Map<string, { sources: SourceRef[]; evidence: EvidenceRef[] }>();

    for (const source of uniqueSources) {
      const topHeading = source.headingPath?.[0] ?? '# Uncategorised';
      const groupKey = topHeading.replace(/^#+\s*/, '').trim() || 'General';
      const key = groupKey.toLowerCase();

      if (!groups.has(key)) {
        groups.set(key, { sources: [], evidence: [] });
      }
      const group = groups.get(key)!;
      group.sources.push(source);

      // Attach matching evidence
      for (const ev of evidence) {
        if (ev.source.relativePath === source.relativePath) {
          if (!group.evidence.some((e) => e.excerpt === ev.excerpt)) {
            group.evidence.push(ev);
          }
        }
      }
    }

    return Array.from(groups.entries()).map(([key, g]) => ({
      groupName: key.charAt(0).toUpperCase() + key.slice(1),
      description: `Sources related to ${key}.`,
      themes: this.extractThemesForGroup(g.sources, g.evidence),
    }));
  }

  /**
   * Extract themes from source groups.
   * Theme descriptions are based only on selected text / heading / evidence.
   * No external facts are introduced.
   */
  private extractThemesForGroup(
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ): LiteratureReviewTheme[] {
    if (sources.length === 0) return [];

    const themes: LiteratureReviewTheme[] = [];
    const seenHeadings = new Set<string>();

    for (const source of sources) {
      const headings = source.headingPath ?? [];
      for (const heading of headings) {
        const clean = heading.replace(/^#+\s*/, '').trim();
        if (!clean || seenHeadings.has(clean)) continue;
        seenHeadings.add(clean);

        const srcRefs: SourceRef[] = [source];
        const evRefs: EvidenceRef[] = evidence.filter(
          (e) => e.source.relativePath === source.relativePath,
        );

        themes.push({
          themeName: clean,
          description: `Theme derived from source: ${source.relativePath}. Heading: ${clean}.`,
          sources: srcRefs,
          evidence: evRefs,
        });
      }
    }

    // If no heading-based themes, create a single fallback
    if (themes.length === 0 && sources.length > 0) {
      themes.push({
        themeName: 'General Findings',
        description: `Findings from ${sources.length} source(s) in this group.`,
        sources: [...sources],
        evidence: [...evidence],
      });
    }

    return themes;
  }

  /**
   * Extract flattened themes from all groups.
   */
  extractThemesFromGroups(groups: LiteratureReviewGroup[]): LiteratureReviewTheme[] {
    return groups.flatMap((g) => g.themes);
  }

  /**
   * Build the literature review draft artifact with themed sections.
   */
  buildLiteratureReviewDraft(
    baseDraft: WritingDraftArtifact,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ): WritingDraftArtifact {
    const now = new Date().toISOString();
    const uniqueSources = this.deduplicateSources(sources);
    const sourceRefs = uniqueSources.slice(0, 5);
    const evidenceRefs = evidence.slice(0, 5);

    return {
      id: generateWritingDraftId(),
      taskType: 'literature_review_draft',
      title: 'Literature Review Draft',
      sections: [
        this.buildIntroductionSection(sourceRefs, evidenceRefs, uniqueSources.length),
        this.buildThematicAnalysisSection(sourceRefs, evidenceRefs, uniqueSources),
        this.buildRelatedWorkSection(sourceRefs, evidenceRefs, uniqueSources, evidence),
        this.buildGapAndLimitationSection(sourceRefs, evidenceRefs),
        this.buildConclusionSection(sourceRefs, evidenceRefs),
      ],
      allCitations: [],
      sourcePackTokenCount: baseDraft.sourcePackTokenCount,
      generatedTokenCount: 400,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      isMockArtifact: true,
      providerId: '',
    };
  }

  /**
   * Build Introduction section.
   */
  private buildIntroductionSection(
    sourceRefs: readonly SourceRef[],
    evidenceRefs: readonly EvidenceRef[],
    sourceCount: number,
  ) {
    const sourcePaths = sourceRefs.map((s) => s.relativePath).join(', ');
    return {
      heading: LITERATURE_REVIEW_SECTIONS[0],
      content: `This literature review is based on ${sourceCount} selected source(s) from the user's Vault: ${sourcePaths}. All claims are source-backed and evidence-backed. This is a draft for user review only — not a final or comprehensive review. No external database was searched.`,
      sources: [...sourceRefs],
      evidence: [...evidenceRefs],
      citations: [],
      confidence: 0.8,
      hasUnsupportedClaims: sourceCount === 0,
      unsupportedClaims: sourceCount === 0 ? ['No sources available for introduction.'] : [],
    };
  }

  /**
   * Build Thematic Analysis section.
   * Themes are extracted from selected source headings and evidence.
   */
  private buildThematicAnalysisSection(
    sourceRefs: readonly SourceRef[],
    evidenceRefs: readonly EvidenceRef[],
    sources: readonly SourceRef[],
  ) {
    const groupedSources = this.groupSourcesByThemeDetailed(sources);
    const themeLines = groupedSources.map(
      (g) => `- **${g.topic}** (${g.count} source(s)): ${g.description}`,
    );

    const content = [
      'The following themes were extracted from the selected Vault sources:',
      ...themeLines,
      '',
      'These themes are derived exclusively from user-selected sources. No external database was consulted. Each theme retains SourceRef for traceability.',
    ].join('\n');

    return {
      heading: LITERATURE_REVIEW_SECTIONS[1],
      content,
      sources: [...sourceRefs],
      evidence: [...evidenceRefs],
      citations: [],
      confidence: 0.7,
      hasUnsupportedClaims: sources.length === 0,
      unsupportedClaims: sources.length === 0
        ? ['Thematic analysis cannot be performed without selected sources.']
        : [],
    };
  }

  /**
   * Build Related Work section.
   * Every claim cites a SourceRef — no fabricated references.
   */
  private buildRelatedWorkSection(
    sourceRefs: readonly SourceRef[],
    evidenceRefs: readonly EvidenceRef[],
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ) {
    const workLines = sources.slice(0, 5).map((s, i) => {
      const evForSource = evidence.filter((e) => e.source.relativePath === s.relativePath);
      const evSnippet = evForSource.length > 0
        ? ` Evidence: "${evForSource[0].excerpt.slice(0, 80)}..."`
        : '';
      const headingInfo = s.headingPath && s.headingPath.length > 0
        ? ` (${s.headingPath.map((h) => h.replace(/^#+\s*/, '')).join(' > ')})`
        : '';
      return `${i + 1}. **${s.relativePath}**${headingInfo} [SourceRef:${i + 1}].${evSnippet}`;
    });

    const content = [
      'Recent work related to the selected topic includes:',
      ...workLines,
      '',
      'All related work citations are backed by SourceRef from the user Vault. No external references were fabricated.',
    ].join('\n');

    return {
      heading: LITERATURE_REVIEW_SECTIONS[2],
      content,
      sources: [...sourceRefs],
      evidence: [...evidenceRefs],
      citations: [],
      confidence: 0.75,
      hasUnsupportedClaims: sources.length === 0,
      unsupportedClaims: sources.length === 0
        ? ['Related work section requires at least one selected source.']
        : [],
    };
  }

  /**
   * Build Gaps and Limitations section.
   * All gap statements are marked as inferential / draft.
   * Never claims "no research exists" without sufficient backing.
   */
  private buildGapAndLimitationSection(
    sourceRefs: readonly SourceRef[],
    evidenceRefs: readonly EvidenceRef[],
  ) {
    const gapStatements = [
      '[INFERENTIAL - DRAFT] Based on the selected sources, the following gaps were identified:',
      '[INFERENTIAL - DRAFT] The coverage of this review is limited to user-selected Vault sources only — no external database was searched.',
      '[INFERENTIAL - DRAFT] Topics not represented in the selected sources may exist in the broader literature.',
      '[INFERENTIAL - DRAFT] This gap analysis is draft-quality and requires user review and validation against the full literature.',
      '',
      '⚠️  IMPORTANT: All gap and limitation statements above are inferential and draft-only.',
      'They do not represent a definitive survey of the field.',
      'The user must supplement with their own domain knowledge and verify against external literature.',
    ];

    return {
      heading: LITERATURE_REVIEW_SECTIONS[3],
      content: gapStatements.join('\n'),
      sources: [...sourceRefs],
      evidence: [...evidenceRefs],
      citations: [],
      confidence: 0.5,
      hasUnsupportedClaims: true,
      unsupportedClaims: [
        'Gap statements are inferential — not based on comprehensive literature search.',
        'Limitations reflect only the selected source scope.',
      ],
    };
  }

  /**
   * Build Conclusion section.
   */
  private buildConclusionSection(
    sourceRefs: readonly SourceRef[],
    evidenceRefs: readonly EvidenceRef[],
  ) {
    return {
      heading: LITERATURE_REVIEW_SECTIONS[4],
      content: 'This literature review draft was generated from user-selected Vault sources only. It is a draft for user review — not a final or comprehensive review. The user should verify all claims, supplement with external literature search, and validate gap statements before considering it complete.',
      sources: [...sourceRefs],
      evidence: [...evidenceRefs],
      citations: [],
      confidence: 0.8,
      hasUnsupportedClaims: false,
      unsupportedClaims: [],
    };
  }

  /**
   * Detailed source grouping by topic for thematic analysis display.
   */
  private groupSourcesByThemeDetailed(
    sources: readonly SourceRef[],
  ): { topic: string; count: number; description: string }[] {
    const uniqueSources = this.deduplicateSources(sources);
    const groups = new Map<string, SourceRef[]>();

    for (const source of uniqueSources) {
      const topHeading = source.headingPath?.[0] ?? '# Uncategorised';
      const key = topHeading.replace(/^#+\s*/, '').trim() || 'General';
      const lowerKey = key.toLowerCase();
      if (!groups.has(lowerKey)) groups.set(lowerKey, []);
      groups.get(lowerKey)!.push(source);
    }

    return Array.from(groups.entries()).map(([key, gs]) => ({
      topic: key.charAt(0).toUpperCase() + key.slice(1),
      count: gs.length,
      description: `${gs.length} source(s) from the user's Vault related to ${key}.`,
    }));
  }

  /**
   * Verify that every section in the draft carries SourceRef and EvidenceRef.
   * Emits warnings for sections lacking source/evidence backing.
   */
  verifySourceBacking(
    draft: WritingDraftArtifact,
    warnings: LiteratureReviewWarning[],
  ): void {
    for (const section of draft.sections) {
      if (section.sources.length === 0 && section.heading !== LITERATURE_REVIEW_SECTIONS[4]) {
        warnings.push({
          code: 'SECTION_MISSING_SOURCE_BACKING',
          message: `Section "${section.heading}" has no SourceRef backing.`,
        });
      }
    }
  }

  /**
   * Count duplicate sources (by relativePath) in the source list.
   */
  countDuplicates(sources: readonly SourceRef[]): number {
    const seen = new Set<string>();
    let dupes = 0;
    for (const s of sources) {
      if (seen.has(s.relativePath)) {
        dupes++;
      } else {
        seen.add(s.relativePath);
      }
    }
    return dupes;
  }

  /**
   * Deduplicate sources, keeping first occurrence.
   */
  deduplicateSources(sources: readonly SourceRef[]): SourceRef[] {
    const seen = new Set<string>();
    return sources.filter((s) => {
      if (seen.has(s.relativePath)) return false;
      seen.add(s.relativePath);
      return true;
    });
  }

  /**
   * Count sources with missing metadata.
   * Cannot detect actual author/title/year fields on SourceRef — this is a
   * deterministic check based on available path headings as a proxy.
   * Sources without a heading path are considered as potentially missing metadata.
   */
  countMissingMetadata(sources: readonly SourceRef[]): number {
    let count = 0;
    for (const s of sources) {
      if (!s.headingPath || s.headingPath.length === 0) {
        count++;
      }
    }
    return count;
  }

  /**
   * Run citation rendering on a draft (public for testing).
   */
  runCitationRendering(
    draft: WritingDraftArtifact,
  ): CitationRenderResult | null {
    try {
      return this.citationRenderer.renderCitations(draft);
    } catch {
      return null;
    }
  }

  /**
   * Run reference guard on a draft (public for testing).
   */
  runReferenceGuard(
    draft: WritingDraftArtifact,
  ): ReferenceGuardResult | null {
    try {
      return this.referenceGuard.guardReferences(draft);
    } catch {
      return null;
    }
  }

  /**
   * Run unsupported claim guard on a draft (public for testing).
   */
  runUnsupportedClaimGuard(
    draft: WritingDraftArtifact,
  ): UnsupportedClaimGuardResult {
    return this.draftGenerator.buildUnsupportedClaimGuard(draft);
  }

  /**
   * Build the literature review generation report.
   */
  buildLiteratureReviewReport(
    mode: LiteratureReviewMode,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
    draft: WritingDraftArtifact,
    guardResult: UnsupportedClaimGuardResult,
    renderResult: CitationRenderResult | null,
    referenceResult: ReferenceGuardResult | null,
    warnings: readonly LiteratureReviewWarning[],
    duplicateCount: number,
    missingMetadataCount: number,
    generatedAt: string,
  ): LiteratureReviewDraftReport {
    const gapSections = draft.sections.filter(
      (s) => s.heading === LITERATURE_REVIEW_SECTIONS[3],
    );
    const gapCount = gapSections.length;

    return {
      mode,
      sourceCount: sources.length,
      evidenceCount: evidence.length,
      themeCount: this.extractThemesFromGroups(
        this.groupSourcesByTheme(sources, evidence),
      ).length,
      citationCount: draft.allCitations.length,
      unsupportedClaimCount: guardResult.unsupportedClaims.length,
      duplicateSourceCount: duplicateCount,
      missingMetadataCount,
      gapStatementsCount: gapCount,
      isMockGeneration: true,
      providerCalled: false,
      guardRan: true,
      citationRenderingRan: renderResult !== null,
      referenceGuardRan: referenceResult !== null,
      generatedAt,
      warnings: warnings.map((w) => w.message),
    };
  }

  /**
   * Build a failure result with errors and optional warnings.
   */
  private failResult(
    mode: LiteratureReviewMode,
    generatedAt: string,
    warnings: LiteratureReviewWarning[],
    errors: LiteratureReviewError[],
  ): LiteratureReviewDraftResult {
    const emptyGuard: UnsupportedClaimGuardResult = {
      passes: false,
      totalClaims: 0,
      supportedClaims: 0,
      unsupportedClaims: [],
    };
    return {
      ok: false,
      draft: null,
      report: {
        mode,
        sourceCount: 0,
        evidenceCount: 0,
        themeCount: 0,
        citationCount: 0,
        unsupportedClaimCount: 0,
        duplicateSourceCount: 0,
        missingMetadataCount: 0,
        gapStatementsCount: 0,
        isMockGeneration: false,
        providerCalled: false,
        guardRan: false,
        citationRenderingRan: false,
        referenceGuardRan: false,
        generatedAt,
        warnings: warnings.map((w) => w.message),
      },
      warnings,
      errors,
      mode,
      guardResult: emptyGuard,
      renderResult: null,
      referenceResult: null,
    };
  }
}
