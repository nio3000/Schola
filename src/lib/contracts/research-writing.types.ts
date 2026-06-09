/**
 * Research Writing Task Contract — Phase 4-3-A.
 *
 * Defines the types for the research writing and literature agent function layer.
 * Built on frozen Phase 4-2 backend foundation (ContextPack v2, Local QA, Memory Tree,
 * Compiled Markdown).
 *
 * Key invariants:
 * - Source-backed / evidence-backed (every factual claim must have SourceRef/EvidenceRef)
 * - Artifact / Draft-first (status: 'draft' → 'reviewed', no 'finalized'/'submitted'/'published')
 * - No fabricated references (no fake DOI/PMID/journal metadata in contracts)
 * - No API Key / secret fields
 * - No Phase 4-4 / Phase 5 type references
 * - relativePath-only for all source/evidence references
 * - Provider synthesis gated behind BYOK + Context Confirmation
 *
 * This is the CONTRACT layer only — no services, no provider calls, no real synthesis.
 */
import type { SourceRef, EvidenceRef } from './local-qa.types';
import type { ContextPackV2Summary } from './context-pack-v2.types';
import type { MemoryTreeNode } from './memory-tree.types';
import type { CompiledMarkdownArtifact } from './compiled-markdown.types';

// ── Writing Task Types ─────────────────────────────────

/**
 * Type of research writing task.
 * Each type maps to a specific writing assistant service in later slices.
 */
export type WritingTaskType =
  | 'abstract_draft'            // 摘要草稿
  | 'introduction_draft'        // 引言草稿
  | 'methods_draft'              // 方法草稿
  | 'results_draft'              // 结果草稿
  | 'discussion_draft'          // 讨论草稿
  | 'conclusion_draft'          // 结论草稿
  | 'literature_review_draft'   // 文献综述草稿
  | 'submission_material_draft' // 投稿材料草稿
  | 'general_research_note';    // 通用研究笔记

/**
 * IMRaD manuscript section types — used by ManuscriptSectionAssistantService.
 */
export type ManuscriptSectionType =
  | 'abstract'
  | 'introduction'
  | 'methods'
  | 'results'
  | 'discussion'
  | 'conclusion';

// ── Writing Task Status ────────────────────────────────

/**
 * Writing draft status.
 *
 * ⚠️  DELIBERATELY NARROW: only 'draft' and 'reviewed'.
 * No 'finalized', 'submitted', 'accepted', or 'published'.
 * The user is always in control of when something is "done".
 */
export type WritingTaskStatus = 'draft' | 'reviewed';

/** Warning attached to a writing task result. */
export interface WritingTaskWarning {
  readonly code: string;
  readonly message: string;
}

/** Error attached to a writing task result. */
export interface WritingTaskError {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
}

// ── Source & Evidence Packs ────────────────────────────

/**
 * Pack of sources assembled for a writing task.
 * All sources are from user-selected Vault scope only.
 */
export interface WritingSourcePack {
  /** Source references from selected Vault files. */
  readonly sources: readonly SourceRef[];
  /** Evidence excerpts backing the writing task. */
  readonly evidence: readonly EvidenceRef[];
  /** Optional memory tree nodes for knowledge structure. */
  readonly memoryTreeNodes: readonly MemoryTreeNode[];
  /** Optional compiled markdown artifact for context. */
  readonly compiledMarkdown: CompiledMarkdownArtifact | null;
  /** Context pack summary for scope transparency (user知情权). */
  readonly contextPackSummary: ContextPackV2Summary;
  /** Total token estimate for the entire source pack. */
  readonly totalTokens: number;
}

// ── Writing Draft Artifact ─────────────────────────────

/**
 * Inline citation marker within a writing draft section.
 *
 * ⚠️  INTENTIONALLY MINIMAL — no doi, pmid, journal, authors, title, or year fields.
 * Real bibliographic metadata enters only after verified source integration
 * (Phase 4-3-C+) or external database real connection.
 */
export interface CitationMarker {
  /** The source being cited. */
  readonly sourceRef: SourceRef;
  /** Rendered citation label, e.g. "[1]" or "(Author, 2024)". */
  readonly label: string;
  /** Character offset of this citation within the section content. */
  readonly position: number;
  /** Whether ReferenceGuard has verified this citation. */
  readonly isVerified: boolean;
}

/**
 * A section within a writing draft artifact.
 * Every factual claim must be backed by sources and evidence.
 */
export interface WritingDraftSection {
  readonly heading: string;
  readonly content: string;
  /** SourceRefs that back this section's claims. */
  readonly sources: readonly SourceRef[];
  /** EvidenceRefs for specific factual claims. */
  readonly evidence: readonly EvidenceRef[];
  /** Inline citation markers within the content. */
  readonly citations: readonly CitationMarker[];
  /** Confidence score (0-1). */
  readonly confidence: number;
  /** True when the section contains claims without source backing. */
  readonly hasUnsupportedClaims: boolean;
  /** List of unsupported claim descriptions for user review. */
  readonly unsupportedClaims: readonly string[];
}

/**
 * The output artifact of a writing task.
 *
 * ⚠️  DRAFT-ONLY — status stays 'draft' or 'reviewed'.
 * No automatic finalization. No automatic save. No Vault overwrite.
 */
export interface WritingDraftArtifact {
  readonly id: string;
  readonly taskType: WritingTaskType;
  readonly title: string;
  readonly sections: readonly WritingDraftSection[];
  /** All citation markers across all sections. */
  readonly allCitations: readonly CitationMarker[];
  /** Token count of the source pack. */
  readonly sourcePackTokenCount: number;
  /** Token count of the generated content. */
  readonly generatedTokenCount: number;
  /** Draft status — always 'draft' initially. */
  readonly status: WritingTaskStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** True when mock-generated (no real provider call). */
  readonly isMockArtifact: boolean;
  /** Provider ID used for generation (empty string if mock). */
  readonly providerId: string;
}

// ── Reference Guard ────────────────────────────────────

/** Reasons why a reference may violate guard rules. */
export type ReferenceViolationReason =
  | 'source_not_in_vault'        // Citation target not in user Vault
  | 'fabricated_doi'             // DOI not verifiable in source
  | 'fabricated_pmid'            // PMID not verifiable in source
  | 'fabricated_journal'         // Journal metadata not in source
  | 'unsupported_claim'          // Claim without source backing
  | 'external_database_claim';   // Claims external DB retrieval without real integration

/** A single reference guard violation. */
export interface ReferenceViolation {
  /** The citation marker that triggered the violation. */
  readonly citation: CitationMarker;
  /** Why the violation occurred. */
  readonly reason: ReferenceViolationReason;
  /** Human-readable detail for user review. */
  readonly detail: string;
}

/** Result of running ReferenceGuard on a writing draft. */
export interface ReferenceGuardResult {
  /** Whether all citations passed guard checks. */
  readonly passes: boolean;
  /** Total number of citations checked. */
  readonly totalCitations: number;
  /** Number of citations that passed verification. */
  readonly verifiedCitations: number;
  /** List of violations found. */
  readonly violations: readonly ReferenceViolation[];
}

// ── Unsupported Claim Guard ────────────────────────────

/** An unsupported claim — a declarative statement without source/evidence backing. */
export interface UnsupportedClaim {
  /** The claim text from the section content. */
  readonly claimText: string;
  /** The section this claim appears in. */
  readonly sectionHeading: string;
  /** Why this claim is considered unsupported. */
  readonly reason: 'no_source' | 'no_evidence' | 'speculative' | 'external_db_claim';
}

/** Result of running UnsupportedClaimGuard on a writing draft. */
export interface UnsupportedClaimGuardResult {
  /** Whether all claims are supported. */
  readonly passes: boolean;
  /** Total number of claims checked. */
  readonly totalClaims: number;
  /** Number of supported claims. */
  readonly supportedClaims: number;
  /** List of unsupported claims. */
  readonly unsupportedClaims: readonly UnsupportedClaim[];
}

// ── Provider Synthesis Gate (Placeholder) ──────────────

/**
 * Provider synthesis gate status.
 * Real provider calls are only allowed when all gate conditions are met.
 * This is a placeholder type — full gate logic in Phase 4-3-B+.
 */
export type ProviderSynthesisGateStatus = 'blocked' | 'pending_confirmation' | 'ready' | 'failed';

/** Conditions that must all be met for real provider synthesis. */
export interface ProviderSynthesisGate {
  readonly status: ProviderSynthesisGateStatus;
  readonly byokConfigured: boolean;
  readonly contextConfirmed: boolean;
  readonly scopeSelected: boolean;
  readonly noWholeVault: boolean;
  readonly sourceBacked: boolean;
  readonly noPriorR1Violation: boolean;
}

// ── Citation Rendering (Phase 4-3-C) ───────────────────

/** Citation rendering style. */
export type CitationRenderStyle = 'inline' | 'reference_list' | 'both';

/** Warning produced during citation rendering. */
export interface CitationRenderWarning {
  readonly code: string;
  readonly message: string;
}

/** A single rendered citation (inline or reference list entry). */
export interface RenderedCitationEntry {
  /** The source being cited. */
  readonly sourceRef: SourceRef;
  /** Rendered text for inline citation, e.g. "[Source: notes/a.md]". */
  readonly inlineText: string;
  /** Rendered text for reference list entry, e.g. "1. notes/a.md". */
  readonly referenceText: string;
}

/** Result of running CitationRenderingService on a draft or its citations. */
export interface CitationRenderResult {
  /** Whether rendering succeeded without warnings. */
  readonly ok: boolean;
  /** Rendered inline citation text (concatenated). */
  readonly inlineCitations: string;
  /** Rendered reference list as formatted text. */
  readonly referenceList: string;
  /** Individual rendered citation entries. */
  readonly entries: readonly RenderedCitationEntry[];
  /** Warnings generated during rendering. */
  readonly warnings: readonly CitationRenderWarning[];
  /** Total number of citations rendered. */
  readonly totalRendered: number;
}

// ── Draft Generator (Phase 4-3-B) ──────────────────────

/**
 * Draft generation mode.
 *
 * - 'mock': deterministic mock draft — no provider call, no network, no SDK.
 * - 'provider_gated': gate check only — validates BYOK + Context Confirmation
 *    but does NOT initiate a real provider call.
 *
 * Real provider synthesis enters in a subsequent controlled slice.
 */
export type DraftGenerationMode = 'mock' | 'provider_gated';

/** Warning attached to a draft generation result. */
export interface DraftGenerationWarning {
  readonly code: string;
  readonly message: string;
}

/**
 * Request to generate a source-backed writing draft.
 *
 * ⚠️  ALL fields required — no auto-population.
 * Evidence is carried via sourcePack.evidence (WritingSourcePack bundles it).
 */
export interface DraftGenerationRequest {
  /** Writing task type from Phase 4-3-A. */
  readonly taskType: WritingTaskType;
  /** Source pack containing sources, evidence, context summary. */
  readonly sourcePack: WritingSourcePack;
  /** User-confirmed context summary — must be a non-empty string. */
  readonly contextConfirmationSummary: string;
  /** Generation mode: mock or provider_gated. */
  readonly mode: DraftGenerationMode;
  /** Optional title override. Defaults to a task-type-based title. */
  readonly title?: string;
}

/**
 * Result of a draft generation attempt.
 *
 * Artifact-first: the draft is always the primary output.
 * Report is always present for observability.
 */
export interface DraftGenerationResult {
  /** Whether the generation succeeded (draft produced). */
  readonly ok: boolean;
  /** The output draft artifact (null on failure). */
  readonly draft: WritingDraftArtifact | null;
  /** Generation report for diagnostics. */
  readonly report: DraftGenerationReport;
  /** Warnings accumulated during generation. */
  readonly warnings: readonly DraftGenerationWarning[];
  /** Errors that prevented generation. */
  readonly errors: readonly DraftGenerationWarning[];
  /** Provider synthesis gate status. */
  readonly providerGate: ProviderSynthesisGate;
  /** True when no sources at all were available. */
  readonly insufficientEvidence: boolean;
  /** Number of sources actually used in the draft. */
  readonly usedSources: number;
  /** Number of evidence refs actually used in the draft. */
  readonly usedEvidence: number;
}

/**
 * Observability report for a draft generation.
 *
 * providerCalled is ALWAYS false in Phase 4-3-B.
 */
export interface DraftGenerationReport {
  readonly taskType: WritingTaskType;
  readonly sectionCount: number;
  readonly sourceCount: number;
  readonly evidenceCount: number;
  readonly unsupportedClaimCount: number;
  readonly citationCount: number;
  readonly isMockGeneration: boolean;
  /** Always false — no real provider call in Phase 4-3-B. */
  readonly providerCalled: boolean;
  readonly generatedAt: string;
  readonly warnings: readonly string[];
}

// ── Manuscript Section Assistant (Phase 4-3-D) ─────────

/** Warning produced during manuscript section drafting. */
export interface ManuscriptSectionWarning {
  readonly code: string;
  readonly message: string;
}

/** Request to generate a manuscript section draft. */
export interface ManuscriptSectionDraftRequest {
  /** IMRaD section type to generate. */
  readonly sectionType: ManuscriptSectionType;
  /** Source pack with sources, evidence, context summary. */
  readonly sourcePack: WritingSourcePack;
  /** User-confirmed context summary. */
  readonly contextConfirmationSummary: string;
  /** Optional title override. */
  readonly title?: string;
}

/** Result of a manuscript section draft generation. */
export interface ManuscriptSectionDraftResult {
  readonly ok: boolean;
  readonly draft: WritingDraftArtifact | null;
  readonly report: ManuscriptSectionDraftReport;
  readonly warnings: readonly ManuscriptSectionWarning[];
  readonly errors: readonly ManuscriptSectionWarning[];
  readonly sectionType: ManuscriptSectionType;
  readonly guardResult: UnsupportedClaimGuardResult;
  readonly renderResult: CitationRenderResult | null;
  readonly referenceResult: ReferenceGuardResult | null;
}

/** Report for a manuscript section draft generation. */
export interface ManuscriptSectionDraftReport {
  readonly sectionType: ManuscriptSectionType;
  readonly sourceCount: number;
  readonly evidenceCount: number;
  readonly citationCount: number;
  readonly unsupportedClaimCount: number;
  readonly isMockGeneration: boolean;
  readonly providerCalled: boolean;
  readonly guardRan: boolean;
  readonly citationRenderingRan: boolean;
  readonly referenceGuardRan: boolean;
  readonly generatedAt: string;
  readonly warnings: readonly string[];
}

// ── Submission Materials Assistant (Phase 4-3-E) ───────

/** Type of submission material to generate. */
export type SubmissionMaterialType =
  | 'cover_letter'
  | 'response_to_reviewers'
  | 'highlights'
  | 'title_suggestion'
  | 'author_contribution'
  | 'conflict_of_interest'
  | 'funding_statement'
  | 'ethics_statement';

/** Warning produced during submission material generation. */
export interface SubmissionMaterialWarning {
  readonly code: string;
  readonly message: string;
}

/** Error produced during submission material generation. */
export interface SubmissionMaterialError {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
}

/** Request to generate a submission material draft. */
export interface SubmissionMaterialRequest {
  /** Type of material to generate. */
  readonly materialType: SubmissionMaterialType;
  /** Source pack with sources, evidence, context summary. */
  readonly sourcePack: WritingSourcePack;
  /** User-confirmed context summary. */
  readonly contextConfirmationSummary: string;
  /**
   * User-provided reviewer comments (required for response_to_reviewers).
   * Must be a non-empty array of comment strings.
   * If empty/omitted for response_to_reviewers, generation is blocked.
   */
  readonly reviewerComments?: readonly string[];
  /**
   * User-provided author contribution facts.
   * If empty/omitted, a placeholder skeleton is generated.
   */
  readonly authorContributionFacts?: readonly string[];
  /**
   * User-provided conflict-of-interest facts.
   * If empty/omitted, a placeholder skeleton is generated.
   */
  readonly conflictOfInterestFacts?: readonly string[];
  /**
   * User-provided funding facts.
   * If empty/omitted, a placeholder skeleton is generated.
   */
  readonly fundingFacts?: readonly string[];
  /**
   * User-provided ethics facts.
   * If empty/omitted, a placeholder skeleton is generated.
   */
  readonly ethicsFacts?: readonly string[];
  /**
   * User-provided journal policy claim with source backing.
   * If omitted, no journal-specific claims are made.
   */
  readonly journalPolicyClaim?: {
    readonly claim: string;
    readonly source: string;
  };
  /** Optional title override. */
  readonly title?: string;
}

/** Result of a submission material generation attempt. */
export interface SubmissionMaterialResult {
  /** Whether generation succeeded. */
  readonly ok: boolean;
  /** The output draft artifact (null on failure). */
  readonly draft: WritingDraftArtifact | null;
  /** Generation report for diagnostics. */
  readonly report: SubmissionMaterialReport;
  /** Warnings accumulated during generation. */
  readonly warnings: readonly SubmissionMaterialWarning[];
  /** Errors that prevented generation. */
  readonly errors: readonly SubmissionMaterialError[];
  /** Type of material that was generated. */
  readonly materialType: SubmissionMaterialType;
  /** Unsupported claim guard result. */
  readonly guardResult: UnsupportedClaimGuardResult;
  /** Citation rendering result (null if not run). */
  readonly renderResult: CitationRenderResult | null;
  /** Reference guard result (null if not run). */
  readonly referenceResult: ReferenceGuardResult | null;
}

/** Report for a submission material generation. */
export interface SubmissionMaterialReport {
  /** Type of material generated. */
  readonly materialType: SubmissionMaterialType;
  /** Number of sources available. */
  readonly sourceCount: number;
  /** Number of evidence refs available. */
  readonly evidenceCount: number;
  /** Number of citations in the draft. */
  readonly citationCount: number;
  /** Number of unsupported claims detected. */
  readonly unsupportedClaimCount: number;
  /** Whether this was a mock generation. */
  readonly isMockGeneration: boolean;
  /** Always false — no real provider call in Phase 4-3-E. */
  readonly providerCalled: boolean;
  /** Whether citation rendering was executed. */
  readonly citationRenderingRan: boolean;
  /** Whether reference guard was executed. */
  readonly referenceGuardRan: boolean;
  /** Whether unsupported claim guard was executed. */
  readonly guardRan: boolean;
  /** ISO timestamp of generation. */
  readonly generatedAt: string;
  /** Human-readable warning summaries. */
  readonly warnings: readonly string[];
  /** Whether reviewer comments were provided. */
  readonly reviewerCommentsProvided: boolean;
  /** Whether journal policy claim was provided with source. */
  readonly journalPolicyClaimProvided: boolean;
}

// ── Utility ─────────────────────────────────────────────

let writingDraftIdCounter = 0;

/** Generate a unique writing draft artifact ID. */
export function generateWritingDraftId(): string {
  return `wd-${Date.now()}-${++writingDraftIdCounter}`;
}

/**
 * Create a minimal mock WritingDraftArtifact for testing / placeholder use.
 * All fields are skeleton values. isMockArtifact is always true.
 */
export function createMockWritingDraft(
  overrides?: Partial<WritingDraftArtifact>,
): WritingDraftArtifact {
  const now = new Date().toISOString();
  return {
    id: generateWritingDraftId(),
    taskType: 'general_research_note',
    title: 'Mock Draft',
    sections: [],
    allCitations: [],
    sourcePackTokenCount: 0,
    generatedTokenCount: 0,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    isMockArtifact: true,
    providerId: '',
    ...overrides,
  };
}

// ── Literature Review Assistant (Phase 4-3-F) ───────────

/**
 * Literature review generation mode.
 *
 * - 'vault_only': only sources from the user's Vault are considered.
 * - 'selected_sources_only': only sources explicitly selected by the user.
 *
 * ⚠️  DELIBERATELY NARROW — no pubmed_search, crossref_search, openalex_search,
 * google_scholar_search, web_search, or auto_discovery modes.
 */
export type LiteratureReviewMode = 'vault_only' | 'selected_sources_only';

/** Warning produced during literature review draft generation. */
export interface LiteratureReviewWarning {
  readonly code: string;
  readonly message: string;
}

/** Error produced during literature review draft generation. */
export interface LiteratureReviewError {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
}

/**
 * A theme extracted from selected source materials.
 * Every theme must retain SourceRef and EvidenceRef.
 */
export interface LiteratureReviewTheme {
  /** Short name for the theme. */
  readonly themeName: string;
  /** Description synthesised from sources. */
  readonly description: string;
  /** SourceRefs that back this theme. */
  readonly sources: readonly SourceRef[];
  /** EvidenceRefs for specific claims within the theme. */
  readonly evidence: readonly EvidenceRef[];
}

/**
 * A specific finding within a theme or source grouping.
 * Every finding must carry SourceRef for traceability.
 */
export interface LiteratureReviewFinding {
  /** Human-readable description of the finding. */
  readonly description: string;
  /** SourceRefs backing this finding. */
  readonly sources: readonly SourceRef[];
  /** EvidenceRefs for specific claims. */
  readonly evidence: readonly EvidenceRef[];
}

/**
 * A group of related sources organised around a common topic.
 */
export interface LiteratureReviewGroup {
  /** Group label e.g. "Deep Learning Methods". */
  readonly groupName: string;
  /** Summary description of the group. */
  readonly description: string;
  /** Themes identified within this group. */
  readonly themes: readonly LiteratureReviewTheme[];
}

/** Request to generate a literature review draft. */
export interface LiteratureReviewDraftRequest {
  /** Source pack with user-selected sources, evidence, context summary. */
  readonly sourcePack: WritingSourcePack;
  /** User-confirmed context summary — must be a non-empty string. */
  readonly contextConfirmationSummary: string;
  /** Review mode — always vault_only or selected_sources_only. */
  readonly mode: LiteratureReviewMode;
  /** Optional title override. */
  readonly title?: string;
}

/** Result of a literature review draft generation attempt. */
export interface LiteratureReviewDraftResult {
  /** Whether the generation succeeded (draft produced). */
  readonly ok: boolean;
  /** The output draft artifact (null on failure). */
  readonly draft: WritingDraftArtifact | null;
  /** Generation report for diagnostics. */
  readonly report: LiteratureReviewDraftReport;
  /** Warnings accumulated during generation. */
  readonly warnings: readonly LiteratureReviewWarning[];
  /** Errors that prevented generation. */
  readonly errors: readonly LiteratureReviewError[];
  /** Review mode used. */
  readonly mode: LiteratureReviewMode;
  /** Unsupported claim guard result. */
  readonly guardResult: UnsupportedClaimGuardResult;
  /** Citation rendering result (null if not run). */
  readonly renderResult: CitationRenderResult | null;
  /** Reference guard result (null if not run). */
  readonly referenceResult: ReferenceGuardResult | null;
}

/** Report for a literature review draft generation. */
export interface LiteratureReviewDraftReport {
  /** Review mode used. */
  readonly mode: LiteratureReviewMode;
  /** Number of sources available. */
  readonly sourceCount: number;
  /** Number of evidence refs available. */
  readonly evidenceCount: number;
  /** Number of themes extracted. */
  readonly themeCount: number;
  /** Number of citations in the draft. */
  readonly citationCount: number;
  /** Number of unsupported claims detected. */
  readonly unsupportedClaimCount: number;
  /** Number of duplicate sources detected. */
  readonly duplicateSourceCount: number;
  /** Number of sources with missing metadata. */
  readonly missingMetadataCount: number;
  /** Number of gap/limitation statements (all marked inferential). */
  readonly gapStatementsCount: number;
  /** Whether this was a mock generation. */
  readonly isMockGeneration: boolean;
  /** Always false — no real provider call in Phase 4-3-F. */
  readonly providerCalled: boolean;
  /** Whether the unsupported claim guard was executed. */
  readonly guardRan: boolean;
  /** Whether citation rendering was executed. */
  readonly citationRenderingRan: boolean;
  /** Whether reference guard was executed. */
  readonly referenceGuardRan: boolean;
  /** ISO timestamp of generation. */
  readonly generatedAt: string;
  /** Human-readable warning summaries. */
  readonly warnings: readonly string[];
}

// ── Research Agent Workflow (Phase 4-3-G) ──────────────

/**
 * Type of research agent workflow.
 * Each workflow type orchestrates one or more frozen Phase 4-3 services.
 *
 * ⚠️  DELIBERATELY NARROW: orchestration only — no provider_call, auto_agent,
 * autonomous, web_search, external_database, production_submit modes.
 */
export type ResearchWorkflowType =
  | 'manuscript_section_workflow'
  | 'literature_review_workflow'
  | 'submission_material_workflow'
  | 'safety_check_workflow'
  | 'research_draft_pipeline';

/**
 * Workflow execution mode.
 *
 * - 'dry_run': validate gates, build plan, but skip actual service calls.
 * - 'mock_run': execute the workflow with deterministic mock service calls.
 *
 * No provider_call mode exists — real provider synthesis is Phase 4-3-G+.
 */
export type ResearchWorkflowMode = 'dry_run' | 'mock_run';

/** Individual step within a workflow plan. */
export type ResearchWorkflowStepType =
  | 'context_confirmation_check'
  | 'source_pack_validation'
  | 'draft_generation'
  | 'citation_rendering'
  | 'reference_guard'
  | 'unsupported_claim_guard'
  | 'artifact_aggregation'
  | 'report_building';

/** Status of a workflow step after execution. */
export type ResearchWorkflowStepStatus =
  | 'pending'
  | 'skipped'
  | 'blocked'
  | 'draft'
  | 'warning'
  | 'completed';

/** Warning produced during workflow execution. */
export interface ResearchWorkflowWarning {
  readonly code: string;
  readonly message: string;
}

/** Error produced during workflow execution. */
export interface ResearchWorkflowError {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
}

/** Result of a single workflow step. */
export interface ResearchWorkflowStepResult {
  /** Step type executed. */
  readonly stepType: ResearchWorkflowStepType;
  /** Status after execution. */
  readonly status: ResearchWorkflowStepStatus;
  /** Step description for observability. */
  readonly description: string;
  /** Warnings from this step. */
  readonly warnings: readonly string[];
  /** Whether the step produced a blocking error. */
  readonly blocked: boolean;
  /** Number of artifacts produced by this step. */
  readonly artifactCount: number;
  /** ISO timestamp of step completion. */
  readonly completedAt: string;
}

/** Request to execute a research agent workflow. */
export interface ResearchWorkflowRequest {
  /** Workflow type to execute. */
  readonly workflowType: ResearchWorkflowType;
  /** Execution mode — dry_run or mock_run. */
  readonly mode: ResearchWorkflowMode;
  /** Source pack with user-selected sources, evidence, context summary. */
  readonly sourcePack: WritingSourcePack;
  /** User-confirmed context summary — must be a non-empty string. */
  readonly contextConfirmationSummary: string;
  /** Optional title override. */
  readonly title?: string;

  // Type-specific fields for routing to frozen services:
  /** For manuscript_section_workflow — IMRaD section type. */
  readonly sectionType?: ManuscriptSectionType;
  /** For submission_material_workflow — material type. */
  readonly materialType?: SubmissionMaterialType;
  /** For submission_material_workflow — reviewer comments (required for response_to_reviewers). */
  readonly reviewerComments?: readonly string[];
  /** Optional journal policy claim for submission material guards. */
  readonly journalPolicyClaim?: {
    readonly claim: string;
    readonly source: string;
  };
}

/** Result of a research agent workflow execution. */
export interface ResearchWorkflowResult {
  /** Whether the workflow completed without blocking errors. */
  readonly ok: boolean;
  /** Workflow type executed. */
  readonly workflowType: ResearchWorkflowType;
  /** Execution mode used. */
  readonly mode: ResearchWorkflowMode;
  /** Aggregated draft artifacts from all steps (null if no drafts produced). */
  readonly drafts: readonly WritingDraftArtifact[];
  /** Workflow execution report. */
  readonly report: ResearchWorkflowReport;
  /** Aggregated warnings from all steps. */
  readonly warnings: readonly ResearchWorkflowWarning[];
  /** Aggregated errors from all steps. */
  readonly errors: readonly ResearchWorkflowError[];
  /** Per-step results for observability. */
  readonly stepResults: readonly ResearchWorkflowStepResult[];
  /** Always false — no real provider call in Phase 4-3-G. */
  readonly providerCalled: boolean;
  /** Always true — user must review before using any output. */
  readonly userReviewRequired: boolean;
}

/** Observability report for a workflow execution. */
export interface ResearchWorkflowReport {
  /** Workflow type executed. */
  readonly workflowType: ResearchWorkflowType;
  /** Execution mode. */
  readonly mode: ResearchWorkflowMode;
  /** Total steps in the workflow plan. */
  readonly totalSteps: number;
  /** Number of completed steps. */
  readonly completedSteps: number;
  /** Number of blocked steps. */
  readonly blockedSteps: number;
  /** Number of steps with warnings. */
  readonly warningSteps: number;
  /** Total draft artifacts produced. */
  readonly totalDrafts: number;
  /** Total warnings across all steps. */
  readonly totalWarnings: number;
  /** Total errors across all steps. */
  readonly totalErrors: number;
  /** Whether the Context Confirmation gate passed. */
  readonly contextConfirmed: boolean;
  /** Whether selected sources were provided. */
  readonly sourcesSelected: boolean;
  /** Whether evidence was provided. */
  readonly evidenceProvided: boolean;
  /** Always false — no real provider call in Phase 4-3-G. */
  readonly providerCalled: boolean;
  /** Always true — user review required. */
  readonly userReviewRequired: boolean;
  /** ISO timestamp of workflow start. */
  readonly startedAt: string;
  /** ISO timestamp of workflow completion. */
  readonly completedAt: string;
}
