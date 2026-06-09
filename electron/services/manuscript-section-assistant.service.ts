/**
 * ManuscriptSectionAssistantService — Phase 4-3-D.
 *
 * Generates section-specific deterministic mock drafts for IMRaD manuscript sections.
 * Integrates with DraftGeneratorService, CitationRenderingService, and ReferenceGuardService.
 *
 * Key invariants:
 * - source-backed / evidence-backed: all factual claims backed by SourceRef/EvidenceRef
 * - section-specific guard: each section type has tailored rules
 * - no invented content: methods/results must reference real sources
 * - draft-only: status always 'draft', never 'final'/'submitted'/'published'
 * - no provider call, no embedding call, no network
 * - no Vault write, no generic IPC
 * - no Phase 4-4 / Phase 5 entry
 */
import type {
  ManuscriptSectionType,
  ManuscriptSectionDraftRequest,
  ManuscriptSectionDraftResult,
  ManuscriptSectionDraftReport,
  ManuscriptSectionWarning,
  WritingDraftArtifact,
  WritingDraftSection,
  WritingSourcePack,
  UnsupportedClaimGuardResult,
  CitationRenderResult,
  ReferenceGuardResult,
} from '../../src/lib/contracts/research-writing.types';
import type { SourceRef, EvidenceRef } from '../../src/lib/contracts/local-qa.types';
import { DraftGeneratorService } from './draft-generator.service';
import type { DraftGenerationRequest } from '../../src/lib/contracts/research-writing.types';
import { CitationRenderingService } from './citation-rendering.service';
import { ReferenceGuardService } from './reference-guard.service';

export class ManuscriptSectionAssistantService {
  private readonly draftGenerator = new DraftGeneratorService();
  private readonly citationRenderer = new CitationRenderingService();
  private readonly referenceGuard = new ReferenceGuardService();

  /**
   * Generate a section-specific draft.
   * Produces a deterministic mock draft with section-specific rules applied.
   */
  generateSectionDraft(
    request: ManuscriptSectionDraftRequest,
  ): ManuscriptSectionDraftResult {
    const warnings: ManuscriptSectionWarning[] = [];
    const errors: ManuscriptSectionWarning[] = [];
    const generatedAt = new Date().toISOString();

    // Validate source pack
    if (!request.sourcePack) {
      return this.failResult(
        request.sectionType, generatedAt,
        [],
        [{ code: 'MISSING_SOURCE_PACK', message: 'Source pack is required.' }],
      );
    }

    const { sourcePack, sectionType } = request;
    const sources = sourcePack.sources;
    const evidence = sourcePack.evidence;

    // Context confirmation
    if (!request.contextConfirmationSummary?.trim()) {
      return this.failResult(
        sectionType, generatedAt, [],
        [{ code: 'NO_CONTEXT_CONFIRMATION', message: 'Context confirmation is required.' }],
      );
    }

    // No source → insufficient_evidence
    if (sources.length === 0) {
      warnings.push({
        code: 'INSUFFICIENT_EVIDENCE',
        message: `No sources available for ${sectionType} section.`,
      });
    }

    // Evidence warning
    if (evidence.length === 0) {
      warnings.push({
        code: 'NO_EVIDENCE',
        message: `No evidence refs provided for ${sectionType} section.`,
      });
    }

    // Build section via DraftGeneratorService
    const draftRequest: DraftGenerationRequest = {
      taskType: this.sectionToTaskType(sectionType),
      sourcePack,
      contextConfirmationSummary: request.contextConfirmationSummary,
      mode: 'mock',
      title: request.title,
    };

    const genResult = this.draftGenerator.generateDraft(draftRequest);

    if (!genResult.draft) {
      return this.failResult(
        sectionType, generatedAt, [],
        [{ code: 'DRAFT_GENERATION_FAILED', message: 'Draft generation failed.' }],
      );
    }

    const draft = genResult.draft;

    // Apply section-specific rules
    const sectionWarnings = this.applySectionRules(sectionType, draft, sources, evidence);
    warnings.push(...sectionWarnings);

    // Forward errors from DraftGenerator as warnings in section context
    if (!genResult.ok) {
      for (const err of genResult.errors) {
        warnings.push({ code: err.code, message: err.message });
      }
    }

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

    const unsupportedCount = guardResult.unsupportedClaims.length;

    return {
      ok: true,
      draft,
      report: {
        sectionType,
        sourceCount: sources.length,
        evidenceCount: evidence.length,
        citationCount: draft.allCitations.length,
        unsupportedClaimCount: unsupportedCount,
        isMockGeneration: true,
        providerCalled: false,
        guardRan: true,
        citationRenderingRan: renderResult !== null,
        referenceGuardRan: referenceResult !== null,
        generatedAt,
        warnings: warnings.map((w) => w.message),
      },
      warnings,
      errors,
      sectionType,
      guardResult,
      renderResult,
      referenceResult,
    };
  }

  // ── Section-specific rules ─────────────────────────────

  private applySectionRules(
    sectionType: ManuscriptSectionType,
    draft: WritingDraftArtifact,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ): ManuscriptSectionWarning[] {
    const warnings: ManuscriptSectionWarning[] = [];

    switch (sectionType) {
      case 'abstract':
        warnings.push(...this.checkAbstract(draft, sources, evidence));
        break;
      case 'introduction':
        warnings.push(...this.checkIntroduction(draft, sources, evidence));
        break;
      case 'methods':
        warnings.push(...this.checkMethods(draft, sources, evidence));
        break;
      case 'results':
        warnings.push(...this.checkResults(draft, sources, evidence));
        break;
      case 'discussion':
        warnings.push(...this.checkDiscussion(draft, sources, evidence));
        break;
      case 'conclusion':
        warnings.push(...this.checkConclusion(draft, sources, evidence));
        break;
    }

    return warnings;
  }

  private checkAbstract(
    _draft: WritingDraftArtifact,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ): ManuscriptSectionWarning[] {
    const warnings: ManuscriptSectionWarning[] = [];
    if (sources.length === 0) {
      warnings.push({ code: 'ABSTRACT_NO_SOURCES', message: 'Abstract draft has no source backing. Cannot verify factual claims.' });
    }
    if (evidence.length === 0) {
      warnings.push({ code: 'ABSTRACT_NO_EVIDENCE', message: 'Abstract draft has no evidence refs. Placeholder only.' });
    }
    return warnings;
  }

  private checkIntroduction(
    _draft: WritingDraftArtifact,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ): ManuscriptSectionWarning[] {
    const warnings: ManuscriptSectionWarning[] = [];
    if (sources.length === 0) {
      warnings.push({ code: 'INTRODUCTION_NO_SOURCES', message: 'Introduction requires sources for factual background.' });
    }
    if (evidence.length < 1 && sources.length > 0) {
      warnings.push({ code: 'INTRODUCTION_LOW_EVIDENCE', message: 'Introduction should include evidence refs for factual claims.' });
    }
    return warnings;
  }

  private checkMethods(
    _draft: WritingDraftArtifact,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ): ManuscriptSectionWarning[] {
    const warnings: ManuscriptSectionWarning[] = [];
    if (sources.length === 0) {
      warnings.push({ code: 'METHODS_NO_SOURCES', message: 'Methods section has no source backing. Experimental methods must reference real sources.' });
    }
    if (evidence.length === 0) {
      warnings.push({ code: 'METHODS_NO_EVIDENCE', message: 'Methods section has no evidence refs. Methods should be backed by real experimental data.' });
    }
    // Methods must not invent — always warn if sources are insufficient
    if (sources.length < 2 && sources.length > 0) {
      warnings.push({ code: 'METHODS_LOW_SOURCES', message: 'Methods section has limited sources. Ensure methods are not invented.' });
    }
    return warnings;
  }

  private checkResults(
    _draft: WritingDraftArtifact,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ): ManuscriptSectionWarning[] {
    const warnings: ManuscriptSectionWarning[] = [];
    if (sources.length === 0) {
      warnings.push({ code: 'RESULTS_NO_SOURCES', message: 'Results section has no source backing. Results must reference real experiments.' });
    }
    if (evidence.length === 0) {
      warnings.push({ code: 'RESULTS_NO_EVIDENCE', message: 'Results section has no evidence refs. Results must be backed by real data — do not invent metrics, p-values, or tables.' });
    }
    return warnings;
  }

  private checkDiscussion(
    _draft: WritingDraftArtifact,
    sources: readonly SourceRef[],
    _evidence: readonly EvidenceRef[],
  ): ManuscriptSectionWarning[] {
    const warnings: ManuscriptSectionWarning[] = [];
    // Always warn about speculative claims in discussion
    warnings.push({
      code: 'DISCUSSION_SPECULATIVE',
      message: 'Discussion draft may contain speculative claims. All speculative claims must be explicitly marked and reviewed by the author.',
    });
    if (sources.length < 2) {
      warnings.push({ code: 'DISCUSSION_LOW_SOURCES', message: 'Discussion section has limited sources. Broader source backing recommended.' });
    }
    return warnings;
  }

  private checkConclusion(
    _draft: WritingDraftArtifact,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ): ManuscriptSectionWarning[] {
    const warnings: ManuscriptSectionWarning[] = [];
    if (sources.length === 0) {
      warnings.push({ code: 'CONCLUSION_NO_SOURCES', message: 'Conclusion has no source backing.' });
    }
    if (evidence.length < 2 && sources.length > 0) {
      warnings.push({ code: 'CONCLUSION_LOW_EVIDENCE', message: 'Conclusion should not exceed available evidence. Limit claims to what sources support.' });
    }
    return warnings;
  }

  // ── Helpers ───────────────────────────────────────────

  private sectionToTaskType(sectionType: ManuscriptSectionType): import('../../src/lib/contracts/research-writing.types').WritingTaskType {
    const map: Record<ManuscriptSectionType, import('../../src/lib/contracts/research-writing.types').WritingTaskType> = {
      abstract: 'abstract_draft',
      introduction: 'introduction_draft',
      methods: 'methods_draft',
      results: 'results_draft',
      discussion: 'discussion_draft',
      conclusion: 'conclusion_draft',
    };
    return map[sectionType];
  }

  private failResult(
    sectionType: ManuscriptSectionType,
    generatedAt: string,
    warnings: ManuscriptSectionWarning[],
    errors: ManuscriptSectionWarning[],
  ): ManuscriptSectionDraftResult {
    return {
      ok: false,
      draft: null,
      report: {
        sectionType,
        sourceCount: 0,
        evidenceCount: 0,
        citationCount: 0,
        unsupportedClaimCount: 0,
        isMockGeneration: true,
        providerCalled: false,
        guardRan: false,
        citationRenderingRan: false,
        referenceGuardRan: false,
        generatedAt,
        warnings: warnings.map((w) => w.message),
      },
      warnings,
      errors,
      sectionType,
      guardResult: { passes: false, totalClaims: 0, supportedClaims: 0, unsupportedClaims: [] },
      renderResult: null,
      referenceResult: null,
    };
  }
}
