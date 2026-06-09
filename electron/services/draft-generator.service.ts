/**
 * DraftGeneratorService — Phase 4-3-B.
 *
 * Source-backed / evidence-backed draft generator.
 * Produces WritingDraftArtifact from user-selected WritingSourcePack.
 *
 * Key invariants:
 * - source-backed: every factual claim must have SourceRef
 * - evidence-backed: every factual claim must have EvidenceRef
 * - Artifact / Draft-first: output is always status 'draft'
 * - no real provider call: mock-only deterministic synthesis OR provider gate check only
 * - no Vault write: drafts are in-memory artifacts only
 * - no generic IPC: service is internal-only
 * - no prompt / response logs: no AI prompt or response is ever logged
 * - no fabricated references: no fake DOI/PMID/journal metadata
 * - no API Key / secret: never stores or transmits credentials
 * - no Phase 4-4 / Phase 5 entry
 *
 * Real provider synthesis enters in a subsequent controlled slice.
 */
import type {
  WritingTaskType,
  WritingSourcePack,
  WritingDraftArtifact,
  WritingDraftSection,
  CitationMarker,
  UnsupportedClaimGuardResult,
  UnsupportedClaim,
  ProviderSynthesisGate,
  DraftGenerationMode,
  DraftGenerationRequest,
  DraftGenerationResult,
  DraftGenerationReport,
  DraftGenerationWarning,
} from '../../src/lib/contracts/research-writing.types';
import { generateWritingDraftId } from '../../src/lib/contracts/research-writing.types';
import type { SourceRef, EvidenceRef } from '../../src/lib/contracts/local-qa.types';

/** Section heading names mapped from WritingTaskType. */
const SECTION_HEADINGS: Record<WritingTaskType, readonly string[]> = {
  abstract_draft: ['Abstract'],
  introduction_draft: ['Introduction', 'Background'],
  methods_draft: ['Methods', 'Experimental Design', 'Data Analysis'],
  results_draft: ['Results', 'Key Findings'],
  discussion_draft: ['Discussion', 'Limitations', 'Implications'],
  conclusion_draft: ['Conclusion', 'Summary'],
  literature_review_draft: ['Literature Review', 'Key Works', 'Research Gaps'],
  submission_material_draft: ['Cover Letter', 'Title Page', 'Author Contributions'],
  general_research_note: ['Research Notes'],
};

/** Default title per task type when no title override is provided. */
function defaultTitle(taskType: WritingTaskType): string {
  const titles: Record<WritingTaskType, string> = {
    abstract_draft: 'Abstract Draft',
    introduction_draft: 'Introduction Draft',
    methods_draft: 'Methods Draft',
    results_draft: 'Results Draft',
    discussion_draft: 'Discussion Draft',
    conclusion_draft: 'Conclusion Draft',
    literature_review_draft: 'Literature Review Draft',
    submission_material_draft: 'Submission Materials Draft',
    general_research_note: 'Research Notes Draft',
  };
  return titles[taskType];
}

export class DraftGeneratorService {
  // ── Public API ────────────────────────────────────────

  /**
   * Generate a source-backed writing draft.
   *
   * 'mock' mode: deterministic mock draft from source pack.
   * 'provider_gated' mode: gate check only, no provider call.
   *
   * Returns DraftGenerationResult with the artifact on success,
   * or errors/warnings when preconditions are not met.
   */
  generateDraft(request: DraftGenerationRequest): DraftGenerationResult {
    const startTime = Date.now();
    const warnings: DraftGenerationWarning[] = [];
    const errors: DraftGenerationWarning[] = [];

    // ── Precondition: source pack required ──────────────
    if (!request.sourcePack) {
      return {
        ok: false,
        draft: null,
        report: this.buildReport(request.taskType, 0, 0, 0, 0, 0, [], true),
        warnings: [],
        errors: [{ code: 'MISSING_SOURCE_PACK', message: 'Source pack is required to generate a draft.' }],
        providerGate: this.buildBlockedGate(false, false),
        insufficientEvidence: true,
        usedSources: 0,
        usedEvidence: 0,
      };
    }

    const { sourcePack } = request;
    const sourceCount = sourcePack.sources.length;
    const evidenceCount = sourcePack.evidence.length;

    // ── Precondition: sources required ──────────────────
    if (sourceCount === 0) {
      const insufficientEvidenceSection: WritingDraftSection = {
        heading: 'Insufficient Evidence',
        content: 'No sources were selected. Draft generation requires at least one source file.',
        sources: [],
        evidence: [],
        citations: [],
        confidence: 0,
        hasUnsupportedClaims: true,
        unsupportedClaims: ['No sources provided — cannot generate source-backed draft.'],
      };

      const now = new Date().toISOString();
      const draft: WritingDraftArtifact = {
        id: generateWritingDraftId(),
        taskType: request.taskType,
        title: request.title ?? defaultTitle(request.taskType),
        sections: [insufficientEvidenceSection],
        allCitations: [],
        sourcePackTokenCount: sourcePack.totalTokens,
        generatedTokenCount: 0,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
        isMockArtifact: true,
        providerId: '',
      };

      errors.push({ code: 'INSUFFICIENT_EVIDENCE', message: 'No sources available. Cannot generate source-backed draft.' });

      return {
        ok: false,
        draft,
        report: this.buildReport(request.taskType, 1, 0, evidenceCount, 1, 0, ['No sources available'], true),
        warnings,
        errors,
        providerGate: this.buildBlockedGate(false, false),
        insufficientEvidence: true,
        usedSources: 0,
        usedEvidence: 0,
      };
    }

    // ── Precondition: evidence required ─────────────────
    if (evidenceCount === 0) {
      warnings.push({
        code: 'NO_EVIDENCE',
        message: 'No evidence refs provided. Draft will use sources only; factual claims may be unsupported.',
      });
    }

    // ── Precondition: context confirmation ──────────────
    const contextConfirmed = this.isContextConfirmed(request.contextConfirmationSummary);

    // ── Provider synthesis gate ─────────────────────────
    const providerGate = this.buildProviderGate(contextConfirmed, request.mode);

    // ── Context Confirmation required for ALL modes ──────
    if (!contextConfirmed) {
      errors.push({
        code: 'NO_CONTEXT_CONFIRMATION',
        message: 'Context confirmation is required before generating a draft. Please review the selected sources and provide a confirmation summary.',
      });
      return {
        ok: false,
        draft: null,
        report: this.buildReport(request.taskType, 0, sourceCount, evidenceCount, 0, 0, [], true),
        warnings,
        errors,
        providerGate,
        insufficientEvidence: false,
        usedSources: 0,
        usedEvidence: 0,
      };
    }

    // ── Gate enforcement ────────────────────────────────
    if (request.mode === 'provider_gated') {
      if (providerGate.status !== 'ready') {
        const gateWarnings: DraftGenerationWarning[] = [];
        if (!providerGate.byokConfigured) {
          gateWarnings.push({ code: 'GATE_BYOK_MISSING', message: 'BYOK not configured. Provider synthesis requires a user-provided API key.' });
        }
        if (!providerGate.contextConfirmed) {
          gateWarnings.push({ code: 'GATE_CONTEXT_NOT_CONFIRMED', message: 'Context confirmation required before provider synthesis.' });
        }
        if (!providerGate.scopeSelected) {
          gateWarnings.push({ code: 'GATE_NO_SCOPE', message: 'Scope must be selected (no whole-Vault synthesis).' });
        }

        const now = new Date().toISOString();
        const blockedDraft: WritingDraftArtifact = {
          id: generateWritingDraftId(),
          taskType: request.taskType,
          title: request.title ?? defaultTitle(request.taskType),
          sections: [{
            heading: 'Provider Gate Blocked',
            content: `Provider synthesis is blocked. Status: ${providerGate.status}. ${gateWarnings.map((w) => w.message).join(' ')}`,
            sources: [],
            evidence: [],
            citations: [],
            confidence: 0,
            hasUnsupportedClaims: false,
            unsupportedClaims: [],
          }],
          allCitations: [],
          sourcePackTokenCount: sourcePack.totalTokens,
          generatedTokenCount: 0,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          isMockArtifact: true,
          providerId: '',
        };

        return {
          ok: false,
          draft: blockedDraft,
          report: this.buildReport(request.taskType, 1, sourceCount, evidenceCount, 0, 0, gateWarnings.map((w) => w.message), true),
          warnings: gateWarnings,
          errors: [],
          providerGate,
          insufficientEvidence: false,
          usedSources: 0,
          usedEvidence: 0,
        };
      }

      // Provider gated but gate is ready — still no real provider call.
      // Phase 4-3-B: return a waiting draft indicating readiness.
      warnings.push({
        code: 'PROVIDER_GATED_READY',
        message: 'Provider gate is ready but real synthesis is not implemented in Phase 4-3-B.',
      });
    }

    // ── Build mock draft sections ───────────────────────
    const sections = this.buildMockSections(
      request.taskType,
      sourcePack,
    );

    const allCitations = sections.flatMap((s) => s.citations);
    const unsupportedClaimCount = sections.reduce((sum, s) => sum + s.unsupportedClaims.length, 0);

    if (unsupportedClaimCount > 0) {
      warnings.push({
        code: 'UNSUPPORTED_CLAIMS',
        message: `${unsupportedClaimCount} unsupported claim(s) detected. Review sections before use.`,
      });
    }

    const now = new Date().toISOString();
    const draft: WritingDraftArtifact = {
      id: generateWritingDraftId(),
      taskType: request.taskType,
      title: request.title ?? defaultTitle(request.taskType),
      sections,
      allCitations,
      sourcePackTokenCount: sourcePack.totalTokens,
      generatedTokenCount: sections.reduce((sum, s) => sum + s.content.length, 0),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      isMockArtifact: true,
      providerId: '',
    };

    const reportWarnings = warnings.map((w) => w.message);
    return {
      ok: true,
      draft,
      report: this.buildReport(
        request.taskType,
        sections.length,
        sourceCount,
        evidenceCount,
        unsupportedClaimCount,
        allCitations.length,
        reportWarnings,
        true,
      ),
      warnings,
      errors,
      providerGate,
      insufficientEvidence: false,
      usedSources: sections.reduce((sum, s) => sum + s.sources.length, 0),
      usedEvidence: sections.reduce((sum, s) => sum + s.evidence.length, 0),
    };
  }

  // ── Private helpers ───────────────────────────────────

  private isContextConfirmed(summary: string): boolean {
    return typeof summary === 'string' && summary.trim().length > 0;
  }

  private buildProviderGate(
    contextConfirmed: boolean,
    mode: DraftGenerationMode,
  ): ProviderSynthesisGate {
    const byokConfigured = false; // Phase 4-3-B: no real provider, so BYOK is not truly configured
    const scopeSelected = true; // Source pack implies scope was selected
    const gate: ProviderSynthesisGate = {
      status: mode === 'mock'
        ? 'blocked'
        : (contextConfirmed && byokConfigured && scopeSelected ? 'ready' : 'blocked'),
      byokConfigured,
      contextConfirmed,
      scopeSelected,
      noWholeVault: true,
      sourceBacked: true,
      noPriorR1Violation: true,
    };
    return gate;
  }

  private buildBlockedGate(
    contextConfirmed: boolean,
    scopeSelected: boolean,
  ): ProviderSynthesisGate {
    return {
      status: 'blocked',
      byokConfigured: false,
      contextConfirmed,
      scopeSelected,
      noWholeVault: true,
      sourceBacked: true,
      noPriorR1Violation: true,
    };
  }

  private buildReport(
    taskType: WritingTaskType,
    sectionCount: number,
    sourceCount: number,
    evidenceCount: number,
    unsupportedClaimCount: number,
    citationCount: number,
    warningMessages: readonly string[],
    isMock: boolean,
  ): DraftGenerationReport {
    return {
      taskType,
      sectionCount,
      sourceCount,
      evidenceCount,
      unsupportedClaimCount,
      citationCount,
      isMockGeneration: isMock,
      providerCalled: false,
      generatedAt: new Date().toISOString(),
      warnings: warningMessages,
    };
  }

  /**
   * Build mock draft sections from the source pack.
   *
   * Each section is source-backed (includes SourceRef) and
   * evidence-backed (includes EvidenceRef from sourcePack.evidence).
   * Citation markers are deterministic placeholders.
   * Unsupported claims are detected when a section has sources but no evidence.
   */
  private buildMockSections(
    taskType: WritingTaskType,
    sourcePack: WritingSourcePack,
  ): WritingDraftSection[] {
    const headings = SECTION_HEADINGS[taskType];
    const sources = sourcePack.sources;
    const evidence = sourcePack.evidence;
    const sections: WritingDraftSection[] = [];

    // Distribute sources evenly across sections
    const sourcesPerSection = Math.max(1, Math.ceil(sources.length / headings.length));
    const evidencePerSection = evidence.length > 0
      ? Math.max(1, Math.ceil(evidence.length / headings.length))
      : 0;

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const sectionSources = sources.slice(i * sourcesPerSection, (i + 1) * sourcesPerSection);
      const sectionEvidence = evidence.slice(i * evidencePerSection, (i + 1) * evidencePerSection);

      const content = this.buildSectionContent(heading, sectionSources, sectionEvidence);
      const citations = this.buildCitationMarkers(sectionSources, content);

      const hasSources = sectionSources.length > 0;
      const hasEvidence = sectionEvidence.length > 0;
      const unsupportedClaims: string[] = [];

      if (!hasSources) {
        unsupportedClaims.push(`Section "${heading}" has no source backing.`);
      }
      if (!hasEvidence && sources.length > 0) {
        unsupportedClaims.push(`Section "${heading}" has source backing but no evidence refs.`);
      }

      sections.push({
        heading,
        content,
        sources: sectionSources.map((s) => ({ ...s })),
        evidence: sectionEvidence.map((e) => ({ ...e })),
        citations,
        confidence: hasSources ? (hasEvidence ? 0.7 : 0.5) : 0,
        hasUnsupportedClaims: unsupportedClaims.length > 0,
        unsupportedClaims,
      });
    }

    return sections;
  }

  /**
   * Build deterministic mock content for a section.
   * Content references source files and evidence refs.
   * No fabricated facts — all content is explicitly placeholder text.
   */
  private buildSectionContent(
    heading: string,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ): string {
    const lines: string[] = [];
    lines.push(`## ${heading}`);
    lines.push('');
    lines.push(`_[Draft placeholder — ${heading.toLowerCase()} content generated from selected sources]_`);
    lines.push('');

    if (sources.length > 0) {
      lines.push(`**Sources (${sources.length}):**`);
      for (let i = 0; i < sources.length; i++) {
        const s = sources[i];
        const label = s.headingPath.length > 0 ? `${s.relativePath} > ${s.headingPath.join(' > ')}` : s.relativePath;
        lines.push(`${i + 1}. \`${label}\` [relevance: ${s.score.toFixed(2)}]`);
      }
      lines.push('');
    }

    if (evidence.length > 0) {
      lines.push(`**Evidence (${evidence.length}):**`);
      for (let i = 0; i < Math.min(evidence.length, 5); i++) {
        const e = evidence[i];
        const preview = e.excerpt.length > 80 ? e.excerpt.substring(0, 80) + '...' : e.excerpt;
        lines.push(`${i + 1}. \`${e.source.relativePath}\` — "${preview}"`);
      }
      lines.push('');
    }

    if (sources.length === 0 && evidence.length === 0) {
      lines.push('_No sources or evidence available for this section._');
    }

    return lines.join('\n');
  }

  /**
   * Build deterministic citation markers from sources.
   * Each source gets a citation placeholder.
   * Position is approximate (start of section content).
   */
  private buildCitationMarkers(
    sources: readonly SourceRef[],
    content: string,
  ): CitationMarker[] {
    return sources.map((source, i) => ({
      sourceRef: { ...source },
      label: `[${i + 1}]`,
      position: content.indexOf(source.relativePath, 0),
      isVerified: false,
    }));
  }

  // ── Provider Gate Inspection ──────────────────────────

  /**
   * Inspect the provider synthesis gate for a given request
   * without generating a draft. Returns gate status only.
   *
   * Pure gate check — no provider call, no draft generation.
   */
  inspectGate(request: DraftGenerationRequest): ProviderSynthesisGate {
    const contextConfirmed = this.isContextConfirmed(request.contextConfirmationSummary);
    return this.buildProviderGate(contextConfirmed, request.mode);
  }

  /**
   * Build an UnsupportedClaimGuardResult from a draft's sections.
   * Placeholder guard — real claim validation enters in Phase 4-3-D.
   */
  buildUnsupportedClaimGuard(draft: WritingDraftArtifact): UnsupportedClaimGuardResult {
    const unsupportedClaims: UnsupportedClaim[] = [];
    let totalClaims = 0;
    let supportedClaims = 0;

    for (const section of draft.sections) {
      totalClaims += Math.max(1, section.sources.length + section.evidence.length);
      supportedClaims += section.sources.length + section.evidence.length;

      for (const claimText of section.unsupportedClaims) {
        // Determine the most specific reason
        let reason: UnsupportedClaim['reason'] = 'no_source';
        if (claimText.includes('no evidence')) {
          reason = 'no_evidence';
        } else if (claimText.includes('speculative')) {
          reason = 'speculative';
        } else if (claimText.includes('external database')) {
          reason = 'external_db_claim';
        }
        unsupportedClaims.push({
          claimText,
          sectionHeading: section.heading,
          reason,
        });
      }
    }

    return {
      passes: unsupportedClaims.length === 0,
      totalClaims,
      supportedClaims,
      unsupportedClaims,
    };
  }
}
