/**
 * SubmissionMaterialsService — Phase 4-3-E.
 *
 * Generates deterministic mock drafts for submission materials:
 * cover letter, response to reviewers, highlights, title suggestion,
 * author contribution, COI/funding/ethics statements.
 *
 * Integrates with DraftGeneratorService, CitationRenderingService,
 * and ReferenceGuardService.
 *
 * Key invariants:
 * - source-backed / evidence-backed: all factual claims backed by SourceRef/EvidenceRef
 * - draft-only: status always 'draft', never 'submitted'/'accepted'/'published'
 * - no provider call, no embedding call, no network
 * - no Vault write, no generic IPC
 * - no automatic submission: no submit/send API
 * - no fabricated reviewer comments
 * - no fabricated journal policy
 * - no fabricated funding, ethics, or COI declarations
 * - no fake journal metadata
 * - no Phase 4-4 / Phase 5 entry
 */
import type {
  SubmissionMaterialType,
  SubmissionMaterialRequest,
  SubmissionMaterialResult,
  SubmissionMaterialReport,
  SubmissionMaterialWarning,
  SubmissionMaterialError,
  WritingDraftArtifact,
  WritingSourcePack,
  UnsupportedClaimGuardResult,
  CitationRenderResult,
  ReferenceGuardResult,
} from '../../src/lib/contracts/research-writing.types';
import { generateWritingDraftId } from '../../src/lib/contracts/research-writing.types';
import type { SourceRef, EvidenceRef } from '../../src/lib/contracts/local-qa.types';
import { DraftGeneratorService } from './draft-generator.service';
import type { DraftGenerationRequest } from '../../src/lib/contracts/research-writing.types';
import { CitationRenderingService } from './citation-rendering.service';
import { ReferenceGuardService } from './reference-guard.service';

const MATERIAL_SECTION_HEADINGS: Record<SubmissionMaterialType, readonly string[]> = {
  cover_letter: ['To the Editor', 'Manuscript Summary', 'Significance Statement', 'Closing'],
  response_to_reviewers: ['General Response', 'Reviewer Comments', 'Point-by-Point Responses'],
  highlights: ['Highlights'],
  title_suggestion: ['Title Suggestions'],
  author_contribution: ['Author Contributions'],
  conflict_of_interest: ['Conflict of Interest Statement'],
  funding_statement: ['Funding Statement'],
  ethics_statement: ['Ethics Statement'],
};

export class SubmissionMaterialsService {
  private readonly draftGenerator = new DraftGeneratorService();
  private readonly citationRenderer = new CitationRenderingService();
  private readonly referenceGuard = new ReferenceGuardService();

  /**
   * Generate a submission material draft.
   * Produces a deterministic mock draft with material-type-specific rules applied.
   */
  generateSubmissionMaterial(
    request: SubmissionMaterialRequest,
  ): SubmissionMaterialResult {
    const warnings: SubmissionMaterialWarning[] = [];
    const errors: SubmissionMaterialError[] = [];
    const generatedAt = new Date().toISOString();
    const { materialType } = request;

    // Validate inputs
    const inputErrors = this.validateSubmissionMaterialInputs(request);
    if (inputErrors.length > 0) {
      return this.failResult(materialType, generatedAt, [], inputErrors);
    }

    // Validate source pack
    if (!request.sourcePack) {
      return this.failResult(
        materialType, generatedAt, [],
        [{ code: 'MISSING_SOURCE_PACK', message: 'Source pack is required.' }],
      );
    }

    const { sourcePack } = request;
    const sources = sourcePack.sources;
    const evidence = sourcePack.evidence;

    // Context confirmation
    if (!request.contextConfirmationSummary?.trim()) {
      return this.failResult(
        materialType, generatedAt, [],
        [{ code: 'NO_CONTEXT_CONFIRMATION', message: 'Context confirmation is required.' }],
      );
    }

    // No source → insufficient_evidence
    if (sources.length === 0) {
      warnings.push({
        code: 'INSUFFICIENT_EVIDENCE',
        message: `No sources available for ${materialType}.`,
      });
    }

    if (evidence.length === 0) {
      warnings.push({
        code: 'NO_EVIDENCE',
        message: `No evidence refs provided for ${materialType}.`,
      });
    }

    // Material-type-specific guards
    const materialErrors = this.applyMaterialGuards(request);
    if (materialErrors.length > 0) {
      return this.failResult(materialType, generatedAt, warnings, materialErrors);
    }

    // Build draft via DraftGeneratorService
    const draftRequest: DraftGenerationRequest = {
      taskType: 'submission_material_draft',
      sourcePack,
      contextConfirmationSummary: request.contextConfirmationSummary,
      mode: 'mock',
      title: request.title,
    };

    const genResult = this.draftGenerator.generateDraft(draftRequest);

    if (!genResult.draft) {
      return this.failResult(
        materialType, generatedAt, warnings,
        [{ code: 'DRAFT_GENERATION_FAILED', message: 'Draft generation failed.' }],
      );
    }

    // Build material-specific draft with custom content
    const draft = this.buildMaterialDraft(materialType, genResult.draft, request, sources, evidence);

    // Forward errors from DraftGenerator as warnings
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
    const hasReviewerComments = (request.reviewerComments?.length ?? 0) > 0;
    const hasJournalPolicy = request.journalPolicyClaim !== undefined;

    return {
      ok: true,
      draft,
      report: {
        materialType,
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
        reviewerCommentsProvided: hasReviewerComments,
        journalPolicyClaimProvided: hasJournalPolicy,
      },
      warnings,
      errors,
      materialType,
      guardResult,
      renderResult,
      referenceResult,
    };
  }

  /**
   * Validate submission material input constraints.
   */
  validateSubmissionMaterialInputs(
    request: SubmissionMaterialRequest,
  ): SubmissionMaterialError[] {
    const errors: SubmissionMaterialError[] = [];

    // response_to_reviewers must have reviewer comments
    if (request.materialType === 'response_to_reviewers') {
      if (!request.reviewerComments || request.reviewerComments.length === 0) {
        errors.push({
          code: 'REVIEWER_COMMENTS_REQUIRED',
          message: 'Reviewer comments are required to generate a response to reviewers.',
          details: 'Provide reviewer comments via reviewerComments field.',
        });
      }
    }

    // Journal policy claim requires source
    if (request.journalPolicyClaim) {
      if (!request.journalPolicyClaim.claim.trim()) {
        errors.push({
          code: 'JOURNAL_POLICY_CLAIM_EMPTY',
          message: 'Journal policy claim text is empty.',
        });
      }
      if (!request.journalPolicyClaim.source.trim()) {
        errors.push({
          code: 'JOURNAL_POLICY_CLAIM_NO_SOURCE',
          message: 'Journal policy claim requires a source.',
          details: 'Provide source backing for the journal policy claim.',
        });
      }
    }

    return errors;
  }

  /**
   * Apply material-type-specific guards.
   * Returns errors that block generation (not warnings).
   */
  applyMaterialGuards(
    request: SubmissionMaterialRequest,
  ): SubmissionMaterialError[] {
    const errors: SubmissionMaterialError[] = [];

    switch (request.materialType) {
      case 'response_to_reviewers': {
        // Already validated in validateSubmissionMaterialInputs
        break;
      }
      case 'cover_letter': {
        // Cover letter: guard journal policy claims
        if (request.journalPolicyClaim) {
          if (!request.journalPolicyClaim.source.trim()) {
            errors.push({
              code: 'JOURNAL_POLICY_CLAIM_UNSOURCED',
              message: 'Journal policy claim must have a verifiable source.',
            });
          }
        }
        break;
      }
      case 'conflict_of_interest':
      case 'funding_statement':
      case 'ethics_statement': {
        // No blocking guards — placeholders are acceptable
        break;
      }
      default: {
        // highlights, title_suggestion, author_contribution — no blocking guards
        break;
      }
    }

    return errors;
  }

  /**
   * Build a material-specific draft artifact with custom content and headings.
   */
  private buildMaterialDraft(
    materialType: SubmissionMaterialType,
    baseDraft: WritingDraftArtifact,
    request: SubmissionMaterialRequest,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
  ): WritingDraftArtifact {
    const now = new Date().toISOString();
    const headings = MATERIAL_SECTION_HEADINGS[materialType];
    const sourceRefs = sources.slice(0, 3);
    const evidenceRefs = evidence.slice(0, 3);

    switch (materialType) {
      case 'cover_letter':
        return this.buildCoverLetterDraft(baseDraft, request, sources, evidence, sourceRefs, evidenceRefs, headings, now);
      case 'response_to_reviewers':
        return this.buildReviewerResponseDraft(baseDraft, request, sources, evidence, sourceRefs, evidenceRefs, headings, now);
      case 'highlights':
        return this.buildHighlightsDraft(baseDraft, sources, evidence, sourceRefs, evidenceRefs, headings, now);
      case 'title_suggestion':
        return this.buildTitleSuggestionDraft(baseDraft, sources, evidence, sourceRefs, evidenceRefs, headings, now);
      case 'author_contribution':
        return this.buildAuthorContributionDraft(baseDraft, request, sources, sourceRefs, evidenceRefs, headings, now);
      case 'conflict_of_interest':
        return this.buildDisclosureSkeleton(baseDraft, request, 'COI', 'conflict_of_interest', sources, sourceRefs, evidenceRefs, headings, now);
      case 'funding_statement':
        return this.buildDisclosureSkeleton(baseDraft, request, 'funding', 'funding_statement', sources, sourceRefs, evidenceRefs, headings, now);
      case 'ethics_statement':
        return this.buildDisclosureSkeleton(baseDraft, request, 'ethics', 'ethics_statement', sources, sourceRefs, evidenceRefs, headings, now);
      default:
        return baseDraft;
    }
  }

  /**
   * Build cover letter draft.
   * Based on manuscript summary and sources. No fake journal claims.
   */
  buildCoverLetterDraft(
    baseDraft: WritingDraftArtifact,
    _request: SubmissionMaterialRequest,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
    sourceRefs: readonly SourceRef[],
    evidenceRefs: readonly EvidenceRef[],
    headings: readonly string[],
    now: string,
  ): WritingDraftArtifact {
    const sourceSummary = sources.length > 0
      ? `Based on ${sources.length} source file(s) from your Vault.`
      : 'No source files available.';

    const evidenceSummary = evidence.length > 0
      ? `Supported by ${evidence.length} evidence excerpt(s).`
      : 'No evidence excerpts provided.';

    return {
      id: generateWritingDraftId(),
      taskType: 'submission_material_draft',
      title: 'Cover Letter Draft',
      sections: [
        {
          heading: headings[0],
          content: `[To the Editor]\n\nWe are pleased to submit our manuscript for consideration.\n\n${sourceSummary}\n\n${evidenceSummary}`,
          sources: sourceRefs,
          evidence: evidenceRefs,
          citations: [],
          confidence: 0.6,
          hasUnsupportedClaims: sources.length === 0,
          unsupportedClaims: sources.length === 0 ? ['Cover letter drafted without source backing.'] : [],
        },
        {
          heading: headings[1],
          content: '[Manuscript Summary]\n\nA summary of the manuscript, based on the provided source materials.',
          sources: sourceRefs,
          evidence: evidenceRefs,
          citations: [],
          confidence: 0.7,
          hasUnsupportedClaims: false,
          unsupportedClaims: [],
        },
        {
          heading: headings[2],
          content: '[Significance]\n\nThis work addresses important questions in the field.',
          sources: sourceRefs,
          evidence: evidenceRefs,
          citations: [],
          confidence: 0.5,
          hasUnsupportedClaims: evidence.length === 0,
          unsupportedClaims: evidence.length === 0 ? ['Significance claims require evidence backing.'] : [],
        },
        {
          heading: headings[3],
          content: '[Closing]\n\nThank you for considering our manuscript.',
          sources: [],
          evidence: [],
          citations: [],
          confidence: 0.9,
          hasUnsupportedClaims: false,
          unsupportedClaims: [],
        },
      ],
      allCitations: [],
      sourcePackTokenCount: baseDraft.sourcePackTokenCount,
      generatedTokenCount: 200,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      isMockArtifact: true,
      providerId: '',
    };
  }

  /**
   * Build response to reviewers draft.
   * Requires user-provided reviewer comments. Cannot fabricate reviewer concerns.
   */
  buildReviewerResponseDraft(
    baseDraft: WritingDraftArtifact,
    request: SubmissionMaterialRequest,
    sources: readonly SourceRef[],
    _evidence: readonly EvidenceRef[],
    sourceRefs: readonly SourceRef[],
    evidenceRefs: readonly EvidenceRef[],
    headings: readonly string[],
    now: string,
  ): WritingDraftArtifact {
    const reviewerComments = request.reviewerComments ?? [];

    return {
      id: generateWritingDraftId(),
      taskType: 'submission_material_draft',
      title: 'Response to Reviewers Draft',
      sections: [
        {
          heading: headings[0],
          content: 'We thank the reviewers for their careful reading and constructive feedback.',
          sources: sourceRefs,
          evidence: evidenceRefs,
          citations: [],
          confidence: 0.9,
          hasUnsupportedClaims: false,
          unsupportedClaims: [],
        },
        {
          heading: headings[1],
          content: reviewerComments.length > 0
            ? `Reviewer Comments:\n${reviewerComments.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\n[Provide point-by-point responses addressing each comment above.]`
            : '[No reviewer comments provided. Cannot generate response target.]',
          sources: sourceRefs,
          evidence: evidenceRefs,
          citations: [],
          confidence: reviewerComments.length > 0 ? 0.7 : 0,
          hasUnsupportedClaims: reviewerComments.length === 0,
          unsupportedClaims: reviewerComments.length === 0
            ? ['Response to reviewers cannot be generated without reviewer comments.']
            : [],
        },
        {
          heading: headings[2],
          content: 'Point-by-point responses to each reviewer comment.',
          sources: sourceRefs,
          evidence: evidenceRefs,
          citations: [],
          confidence: 0.6,
          hasUnsupportedClaims: sources.length === 0,
          unsupportedClaims: sources.length === 0 ? ['Point-by-point responses require source backing.'] : [],
        },
      ],
      allCitations: [],
      sourcePackTokenCount: baseDraft.sourcePackTokenCount,
      generatedTokenCount: 200,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      isMockArtifact: true,
      providerId: '',
    };
  }

  /**
   * Build highlights draft.
   * Based on evidence and manuscript. No invented results.
   */
  buildHighlightsDraft(
    baseDraft: WritingDraftArtifact,
    sources: readonly SourceRef[],
    evidence: readonly EvidenceRef[],
    sourceRefs: readonly SourceRef[],
    evidenceRefs: readonly EvidenceRef[],
    headings: readonly string[],
    now: string,
  ): WritingDraftArtifact {
    const highlightItems = evidence.length > 0
      ? evidence.slice(0, 5).map((e) => `- ${e.excerpt}`)
      : sources.length > 0
        ? sources.slice(0, 5).map((s) => `- Key finding from ${s.relativePath}`)
        : ['- [No sources or evidence available for highlights.]'];

    return {
      id: generateWritingDraftId(),
      taskType: 'submission_material_draft',
      title: 'Highlights Draft',
      sections: [
        {
          heading: headings[0],
          content: highlightItems.join('\n'),
          sources: sourceRefs,
          evidence: evidenceRefs,
          citations: [],
          confidence: evidence.length > 0 ? 0.7 : 0.3,
          hasUnsupportedClaims: evidence.length === 0,
          unsupportedClaims: evidence.length === 0
            ? ['Highlights drafted without evidence backing. Review and verify all claims.']
            : [],
        },
      ],
      allCitations: [],
      sourcePackTokenCount: baseDraft.sourcePackTokenCount,
      generatedTokenCount: 100,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      isMockArtifact: true,
      providerId: '',
    };
  }

  /**
   * Build title suggestion draft.
   * Generates candidate titles based on sources. No journal preference claims.
   */
  buildTitleSuggestionDraft(
    baseDraft: WritingDraftArtifact,
    sources: readonly SourceRef[],
    _evidence: readonly EvidenceRef[],
    sourceRefs: readonly SourceRef[],
    evidenceRefs: readonly EvidenceRef[],
    headings: readonly string[],
    now: string,
  ): WritingDraftArtifact {
    const sourceNames = sources.slice(0, 3).map((s) => {
      const parts = s.relativePath.split('/');
      const name = parts[parts.length - 1].replace(/\.\w+$/, '');
      return name.replace(/[-_]/g, ' ');
    });

    const suggestions = sourceNames.length > 0
      ? sourceNames.map((n) => `- ${n.charAt(0).toUpperCase() + n.slice(1)}: A Comprehensive Analysis`)
      : ['- [No sources available for title generation.]'];

    return {
      id: generateWritingDraftId(),
      taskType: 'submission_material_draft',
      title: 'Title Suggestions Draft',
      sections: [
        {
          heading: headings[0],
          content: `Candidate titles (select and refine):\n\n${suggestions.join('\n')}`,
          sources: sourceRefs,
          evidence: evidenceRefs,
          citations: [],
          confidence: 0.5,
          hasUnsupportedClaims: sources.length === 0,
          unsupportedClaims: sources.length === 0
            ? ['Title suggestions cannot be generated without source materials.']
            : [],
        },
      ],
      allCitations: [],
      sourcePackTokenCount: baseDraft.sourcePackTokenCount,
      generatedTokenCount: 80,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      isMockArtifact: true,
      providerId: '',
    };
  }

  /**
   * Build author contribution draft.
   * Skeleton if no author facts provided; populated draft if facts are given.
   */
  buildAuthorContributionDraft(
    baseDraft: WritingDraftArtifact,
    request: SubmissionMaterialRequest,
    sources: readonly SourceRef[],
    sourceRefs: readonly SourceRef[],
    evidenceRefs: readonly EvidenceRef[],
    headings: readonly string[],
    now: string,
  ): WritingDraftArtifact {
    const facts = request.authorContributionFacts ?? [];
    const isPlaceholder = facts.length === 0;

    let content: string;
    const unsupportedClaims: string[] = [];

    if (isPlaceholder) {
      content = '[Author Contributions — placeholder. Provide author names and contributions to complete this section.]\n\n' +
        'Example format:\n' +
        '- Author A: Conceptualization, Methodology, Writing\n' +
        '- Author B: Data curation, Formal analysis\n' +
        '- Author C: Supervision, Funding acquisition';
      unsupportedClaims.push('Author contribution is a placeholder. Provide actual author contribution facts.');
    } else {
      content = facts.map((f) => `- ${f}`).join('\n');
    }

    return {
      id: generateWritingDraftId(),
      taskType: 'submission_material_draft',
      title: 'Author Contributions Draft',
      sections: [
        {
          heading: headings[0],
          content,
          sources: sourceRefs,
          evidence: evidenceRefs,
          citations: [],
          confidence: isPlaceholder ? 0 : 0.8,
          hasUnsupportedClaims: isPlaceholder,
          unsupportedClaims,
        },
      ],
      allCitations: [],
      sourcePackTokenCount: baseDraft.sourcePackTokenCount,
      generatedTokenCount: 80,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      isMockArtifact: true,
      providerId: '',
    };
  }

  /**
   * Build disclosure skeleton for COI, funding, or ethics statement.
   * Placeholder if no user facts provided. Never fabricates declarations.
   */
  buildDisclosureSkeleton(
    baseDraft: WritingDraftArtifact,
    request: SubmissionMaterialRequest,
    field: 'COI' | 'funding' | 'ethics',
    materialType: SubmissionMaterialType,
    sources: readonly SourceRef[],
    sourceRefs: readonly SourceRef[],
    evidenceRefs: readonly EvidenceRef[],
    headings: readonly string[],
    now: string,
  ): WritingDraftArtifact {
    let facts: readonly string[] = [];
    let statementLabel: string;

    switch (field) {
      case 'COI':
        facts = request.conflictOfInterestFacts ?? [];
        statementLabel = 'Conflict of Interest Statement';
        break;
      case 'funding':
        facts = request.fundingFacts ?? [];
        statementLabel = 'Funding Statement';
        break;
      case 'ethics':
        facts = request.ethicsFacts ?? [];
        statementLabel = 'Ethics Statement';
        break;
    }

    const isPlaceholder = facts.length === 0;
    let content: string;
    const unsupportedClaims: string[] = [];
    const warnings: string[] = [];

    if (isPlaceholder) {
      switch (field) {
        case 'COI':
          content = `[${statementLabel} — Placeholder]\n\n` +
            'Please declare any competing interests. Examples:\n' +
            '- Financial interests related to this work\n' +
            '- Personal or professional relationships\n' +
            '- Patent or intellectual property holdings\n' +
            'If no competing interests exist, you may state: "The authors declare no competing interests."';
          unsupportedClaims.push(`${statementLabel} is a placeholder. Provide actual conflict-of-interest information.`);
          break;
        case 'funding':
          content = `[${statementLabel} — Placeholder]\n\n` +
            'Please list all funding sources that supported this work.\n' +
            'Include grant numbers where applicable.\n' +
            'Examples:\n' +
            '- National Science Foundation (Grant No. XXX-XXXXX)\n' +
            '- University Research Fund';
          unsupportedClaims.push(`${statementLabel} is a placeholder. Provide actual funding information.`);
          break;
        case 'ethics':
          content = `[${statementLabel} — Placeholder]\n\n` +
            'Please provide ethics approval information if applicable.\n' +
            'Include:\n' +
            '- Name of ethics committee or institutional review board\n' +
            '- Approval number or reference\n' +
            '- Date of approval\n' +
            'If not applicable, state the reason (e.g., "This study did not involve human or animal subjects").';
          unsupportedClaims.push(`${statementLabel} is a placeholder. Provide actual ethics approval information.`);
          break;
      }
    } else {
      content = facts.map((f) => `- ${f}`).join('\n');
    }

    // No source backing → placeholder claims are flagged
    if (sources.length === 0 && isPlaceholder) {
      warnings.push(`No sources available for ${materialType} draft.`);
    }

    return {
      id: generateWritingDraftId(),
      taskType: 'submission_material_draft',
      title: `${statementLabel} Draft`,
      sections: [
        {
          heading: headings[0],
          content,
          sources: sourceRefs,
          evidence: evidenceRefs,
          citations: [],
          confidence: isPlaceholder ? 0 : 0.8,
          hasUnsupportedClaims: isPlaceholder,
          unsupportedClaims,
        },
      ],
      allCitations: [],
      sourcePackTokenCount: baseDraft.sourcePackTokenCount,
      generatedTokenCount: 80,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      isMockArtifact: true,
      providerId: '',
    };
  }

  /**
   * Guard journal policy claim — must have source backing.
   */
  guardJournalPolicyClaim(
    request: SubmissionMaterialRequest,
  ): SubmissionMaterialError[] {
    const errors: SubmissionMaterialError[] = [];

    if (request.journalPolicyClaim) {
      const { claim, source } = request.journalPolicyClaim;

      if (!source.trim()) {
        errors.push({
          code: 'JOURNAL_POLICY_CLAIM_NO_SOURCE',
          message: 'Journal policy claim requires a source reference.',
          details: 'Provide a verifiable source for journal-specific policy claims.',
        });
      }

      if (!claim.trim()) {
        errors.push({
          code: 'JOURNAL_POLICY_CLAIM_EMPTY',
          message: 'Journal policy claim text is empty.',
        });
      }

      // Guard against fake journal metadata in the claim/source
      const fakeJournalPatterns = [
        /Journal\s+of\s+\w+/i,
        /ISSN:\s*[\d-]+/i,
        /Impact\s+Factor:\s*[\d.]+/i,
        /Publisher:\s*\w+/i,
        /Editor-in-Chief:/i,
      ];

      for (const pattern of fakeJournalPatterns) {
        if (pattern.test(claim) || pattern.test(source)) {
          errors.push({
            code: 'FAKE_JOURNAL_METADATA',
            message: 'Journal policy claim must not contain fabricated journal metadata.',
            details: `Detected pattern: ${pattern.source}`,
          });
          break;
        }
      }
    }

    return errors;
  }

  /**
   * Build a SubmissionMaterialReport.
   */
  buildSubmissionMaterialReport(
    materialType: SubmissionMaterialType,
    sourceCount: number,
    evidenceCount: number,
    citationCount: number,
    unsupportedClaimCount: number,
    generatedAt: string,
    warnings: readonly string[],
    reviewerCommentsProvided: boolean,
    journalPolicyClaimProvided: boolean,
  ): SubmissionMaterialReport {
    return {
      materialType,
      sourceCount,
      evidenceCount,
      citationCount,
      unsupportedClaimCount,
      isMockGeneration: true,
      providerCalled: false,
      citationRenderingRan: true,
      referenceGuardRan: true,
      guardRan: true,
      generatedAt,
      warnings,
      reviewerCommentsProvided,
      journalPolicyClaimProvided,
    };
  }

  /**
   * Build a failure result.
   */
  private failResult(
    materialType: SubmissionMaterialType,
    generatedAt: string,
    warnings: readonly SubmissionMaterialWarning[],
    errors: readonly SubmissionMaterialError[],
  ): SubmissionMaterialResult {
    return {
      ok: false,
      draft: null,
      report: {
        materialType,
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
        reviewerCommentsProvided: false,
        journalPolicyClaimProvided: false,
      },
      warnings,
      errors,
      materialType,
      guardResult: {
        passes: false,
        totalClaims: 0,
        supportedClaims: 0,
        unsupportedClaims: [],
      },
      renderResult: null,
      referenceResult: null,
    };
  }
}
