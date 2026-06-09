/**
 * PPT / Multimodal Artifact Contract — Phase 4-4-A.
 *
 * Defines the types for slide deck artifacts, slide plans, content blocks,
 * multimodal asset references, and artifact generation primitives.
 *
 * This is the CONTRACT layer only — no services, no renderers, no provider calls,
 * no real PPT generation, no export implementation.
 *
 * Key invariants:
 * - source-backed / evidence-backed: factual slide blocks carry SourceRef/EvidenceRef
 * - Artifact / Draft-first: status always 'draft', never 'final'/'published'
 * - asset references are relativePath-only: no absolute paths, no external URLs
 * - no fabricated content: all factual claims must have SourceRef
 * - no provider call, no embedding call, no network
 * - no Vault write, no generic IPC
 * - no automatic export, no final presentation status
 * - no Phase 5 plugin entry
 */
import type { SourceRef, EvidenceRef } from './local-qa.types';

// ── Slide Plan ──────────────────────────────────────────

/** A section within a slide deck plan. */
export interface SlideSectionPlan {
  /** Section title, e.g. "Introduction". */
  readonly title: string;
  /** Estimated slide count for this section. */
  readonly estimatedSlideCount: number;
  /** SourceRefs backing this section's content. */
  readonly sources: readonly SourceRef[];
  /** Human-readable description of what this section covers. */
  readonly description: string;
}

/**
 * A slide deck plan — the structural outline before slide generation.
 * Must reference user-selected Vault sources only.
 */
export interface SlidePlan {
  /** Presentation title. */
  readonly title: string;
  /** Optional subtitle. */
  readonly subtitle: string;
  /** Ordered list of sections. */
  readonly sections: readonly SlideSectionPlan[];
  /** Total estimated slide count. */
  readonly totalEstimatedSlides: number;
  /** SourceRefs across the entire plan. */
  readonly allSources: readonly SourceRef[];
}

// ── Slide Content ───────────────────────────────────────

/** Types of content blocks within a slide. */
export type SlideContentBlockType =
  | 'title'
  | 'subtitle'
  | 'text'
  | 'bullet_list'
  | 'image'
  | 'table'
  | 'chart'
  | 'code_block'
  | 'quote'
  | 'section_header';

/** Reference to a multimodal asset (image, chart, table) within a slide. */
export interface MultimodalAssetRef {
  /**
   * Relative path to the asset file within the Vault.
   *
   * ⚠️  RELATIVE-PATH ONLY — never an absolute path.
   * ⚠️  EXTERNAL URL BLOCKED in Phase 4-4-A — no https:// references.
   */
  readonly relativePath: string;
  /** Asset type label for display. */
  readonly assetType: 'image' | 'chart' | 'table' | 'diagram';
  /** Alt text or caption. */
  readonly caption: string;
  /** SourceRefs backing the asset data. */
  readonly sources: readonly SourceRef[];
}

/**
 * A single content block within a slide.
 * Every factual block must carry SourceRef or EvidenceRef.
 */
export interface SlideContentBlock {
  /** Type of content. */
  readonly blockType: SlideContentBlockType;
  /** The rendered text or markdown content. */
  readonly content: string;
  /** Ordered list items (for bullet_list type). */
  readonly items: readonly string[];
  /** SourceRefs backing the factual claims in this block. */
  readonly sources: readonly SourceRef[];
  /** EvidenceRefs for specific factual claims. */
  readonly evidence: readonly EvidenceRef[];
  /** Multimedia asset reference (for image/table/chart types). */
  readonly assetRef: MultimodalAssetRef | null;
  /** Confidence score (0-1). */
  readonly confidence: number;
  /** True when the block contains claims without source backing. */
  readonly hasUnsupportedClaims: boolean;
}

/** Supported slide layout types. */
export type SlideLayout =
  | 'title_slide'
  | 'section_header'
  | 'content'
  | 'two_column'
  | 'image_caption'
  | 'quote'
  | 'blank';

// ── Slide Item ──────────────────────────────────────────

/** A single slide within a slide deck. */
export interface SlideItem {
  /** Zero-based slide index. */
  readonly index: number;
  /** Slide title. */
  readonly title: string;
  /** Slide layout type. */
  readonly layout: SlideLayout;
  /** Ordered content blocks. */
  readonly blocks: readonly SlideContentBlock[];
  /** Speaker notes (optional). */
  readonly notes: string;
  /** All SourceRefs across all blocks in this slide. */
  readonly allSources: readonly SourceRef[];
  /** All EvidenceRefs across all blocks in this slide. */
  readonly allEvidence: readonly EvidenceRef[];
  /** True if any block has unsupported claims. */
  readonly hasUnsupportedClaims: boolean;
}

// ── Slide Deck Artifact ─────────────────────────────────

/** Artifact status — deliberately narrow. */
export type SlideDeckStatus = 'draft' | 'reviewed';

/** Warning attached to an artifact generation result. */
export interface ArtifactGenerationWarning {
  readonly code: string;
  readonly message: string;
}

/** Error attached to an artifact generation result. */
export interface ArtifactGenerationError {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
}

/**
 * The complete slide deck artifact.
 *
 * ⚠️  DRAFT-ONLY — status stays 'draft' or 'reviewed'.
 * No 'final', 'exported', 'presented', 'published', or 'shared'.
 */
export interface SlideDeckArtifact {
  /** Unique artifact ID. */
  readonly id: string;
  /** Presentation title. */
  readonly title: string;
  /** Optional subtitle. */
  readonly subtitle: string;
  /** The ordered list of slides. */
  readonly slides: readonly SlideItem[];
  /** The plan that generated this deck. */
  readonly plan: SlidePlan | null;
  /** Draft status — always 'draft' initially. */
  readonly status: SlideDeckStatus;
  /** Total slide count. */
  readonly slideCount: number;
  /** Total SourceRef count across all slides. */
  readonly totalSourceRefs: number;
  /** Total EvidenceRef count across all slides. */
  readonly totalEvidenceRefs: number;
  /** True when mock-generated (no real provider call). */
  readonly isMockArtifact: boolean;
  /** Always false — no real provider call in Phase 4-4. */
  readonly providerCalled: boolean;
  /** Provider ID used for generation (empty string if mock). */
  readonly providerId: string;
  /** User must review before using. Always true. */
  readonly userReviewRequired: boolean;
  /** ISO timestamp of creation. */
  readonly createdAt: string;
  /** ISO timestamp of last update. */
  readonly updatedAt: string;
}

// ── PPT Artifact (full PPT wrapper) ─────────────────────

/** Supported PPT export target formats. */
export type ArtifactExportTarget = 'pptx' | 'pdf' | 'html' | 'markdown';

/** Supported preview modes. */
export type ArtifactPreviewTarget = 'slide_sorter' | 'presenter_view' | 'outline_view';

/** The full PPT artifact — wraps the slide deck with export/preview metadata. */
export interface PPTArtifact {
  /** The underlying slide deck. */
  readonly deck: SlideDeckArtifact;
  /** Available export targets. */
  readonly exportTargets: readonly ArtifactExportTarget[];
  /** Available preview modes. */
  readonly previewTargets: readonly ArtifactPreviewTarget[];
  /** Whether automatic export is allowed (always false in Phase 4-4). */
  readonly autoExportEnabled: boolean;
  /** Draft status — always 'draft' initially. */
  readonly status: SlideDeckStatus;
  /** User must review before any export. Always true. */
  readonly userReviewRequired: boolean;
  /** Always false — no real provider call. */
  readonly providerCalled: boolean;
  /** ISO timestamp. */
  readonly createdAt: string;
}

// ── Artifact Generation ─────────────────────────────────

/**
 * Request to generate a slide deck / PPT artifact.
 *
 * All sources must be from user-selected Vault scope only.
 */
export interface ArtifactGenerationRequest {
  /** Type of artifact to generate. */
  readonly artifactType: 'slide_deck' | 'ppt_artifact';
  /** Source pack with sources, evidence, and context summary. */
  readonly sourcePack: {
    readonly sources: readonly SourceRef[];
    readonly evidence: readonly EvidenceRef[];
    readonly contextConfirmationSummary: string;
    readonly totalTokens: number;
  };
  /** Optional title override. */
  readonly title?: string;
  /** Optional subtitle. */
  readonly subtitle?: string;
  /** Optional slide plan to follow (generated if not provided). */
  readonly plan?: SlidePlan;
}

/** Result of artifact generation attempt. */
export interface ArtifactGenerationResult {
  /** Whether generation succeeded. */
  readonly ok: boolean;
  /** The output slide deck artifact (null on failure). */
  readonly deck: SlideDeckArtifact | null;
  /** The output PPT artifact (null on failure or if artifactType is slide_deck). */
  readonly pptArtifact: PPTArtifact | null;
  /** Generation report for diagnostics. */
  readonly report: ArtifactGenerationReport;
  /** Warnings accumulated during generation. */
  readonly warnings: readonly ArtifactGenerationWarning[];
  /** Errors that prevented generation. */
  readonly errors: readonly ArtifactGenerationError[];
  /** Always false — no real provider call. */
  readonly providerCalled: boolean;
}

/** Observability report for artifact generation. */
export interface ArtifactGenerationReport {
  /** Type of artifact generated. */
  readonly artifactType: 'slide_deck' | 'ppt_artifact';
  /** Number of slides generated. */
  readonly slideCount: number;
  /** Number of content blocks across all slides. */
  readonly blockCount: number;
  /** Number of SourceRefs in the artifact. */
  readonly sourceRefCount: number;
  /** Number of EvidenceRefs in the artifact. */
  readonly evidenceRefCount: number;
  /** Number of unsupported claims detected. */
  readonly unsupportedClaimCount: number;
  /** Whether this was a mock generation. */
  readonly isMockGeneration: boolean;
  /** Always false — no real provider call in Phase 4-4. */
  readonly providerCalled: boolean;
  /** Whether the user must review before use. Always true. */
  readonly userReviewRequired: boolean;
  /** Available export targets. */
  readonly exportTargets: readonly ArtifactExportTarget[];
  /** ISO timestamp of generation. */
  readonly generatedAt: string;
  /** Human-readable warning summaries. */
  readonly warnings: readonly string[];
}

// ── Utility ─────────────────────────────────────────────

let slideDeckIdCounter = 0;

/** Generate a unique slide deck artifact ID. */
export function generateSlideDeckId(): string {
  return `sd-${Date.now()}-${++slideDeckIdCounter}`;
}

/**
 * Create a minimal mock SlideDeckArtifact for testing.
 * All fields are skeleton values. isMockArtifact is always true.
 */
export function createMockSlideDeck(
  overrides?: Partial<SlideDeckArtifact>,
): SlideDeckArtifact {
  const now = new Date().toISOString();
  return {
    id: generateSlideDeckId(),
    title: 'Mock Presentation',
    subtitle: '',
    slides: [],
    plan: null,
    status: 'draft',
    slideCount: 0,
    totalSourceRefs: 0,
    totalEvidenceRefs: 0,
    isMockArtifact: true,
    providerCalled: false,
    providerId: '',
    userReviewRequired: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a minimal mock PPTArtifact for testing.
 */
export function createMockPPTArtifact(
  deck?: SlideDeckArtifact,
): PPTArtifact {
  const now = new Date().toISOString();
  return {
    deck: deck ?? createMockSlideDeck(),
    exportTargets: ['pptx', 'pdf'],
    previewTargets: ['slide_sorter', 'outline_view'],
    autoExportEnabled: false,
    status: 'draft',
    userReviewRequired: true,
    providerCalled: false,
    createdAt: now,
  };
}

// ── Asset Reference Guard (Phase 4-4-D placeholder) ─────

/** Reasons why an asset reference may be rejected. */
export type AssetRefViolationReason =
  | 'absolute_path'           // Path is not relative
  | 'external_url'            // URL is external (https://...)
  | 'outside_vault'           // Path resolves outside Vault root
  | 'file_not_found'          // Referenced file does not exist
  | 'unsupported_format'      // Asset format not supported
  | 'no_source_backing';      // Asset has no SourceRef

/** A single asset reference violation. */
export interface AssetRefViolation {
  /** The asset reference that triggered the violation. */
  readonly assetRef: MultimodalAssetRef;
  /** Why the violation occurred. */
  readonly reason: AssetRefViolationReason;
  /** Human-readable detail. */
  readonly detail: string;
}

/** Result of validating asset references. */
export interface AssetRefValidationResult {
  /** Whether all asset references passed validation. */
  readonly passes: boolean;
  /** Total number of asset references checked. */
  readonly totalRefs: number;
  /** Number of violations found. */
  readonly violations: readonly AssetRefViolation[];
}

// ── Slide Plan Generation (Phase 4-4-B) ─────────────────

/**
 * Request to generate a SlidePlan from selected sources, artifacts,
 * or user-provided content.
 *
 * At least one of selectedSources, selectedArtifacts, or userProvidedContent
 * must be non-empty. No input triggers insufficient_evidence.
 *
 * ⚠️  No providerModel, apiKey, embeddingModel, pptMasterEnabled,
 *    autoExport, writeToVault, or pluginRun fields.
 */
export interface SlidePlanGenerationRequest {
  /** Unique request identifier. */
  readonly requestId: string;
  /** Presentation topic. */
  readonly topic: string;
  /** Purpose of the presentation (e.g. "conference", "lecture", "seminar"). */
  readonly purpose: string;
  /** Target audience description. */
  readonly audience: string;
  /** Maximum number of slides to generate (enforced as upper bound). */
  readonly maxSlides: number;
  /** User-selected Vault sources backing the plan. */
  readonly selectedSources: readonly SourceRef[];
  /** References to existing artifacts (e.g. writing drafts) to draw from. */
  readonly selectedArtifacts: readonly { readonly id: string; readonly type: string }[];
  /** Free-form user-provided content (e.g. outline, notes). */
  readonly userProvidedContent: string;
  /** Whether the user confirmed the selected context. */
  readonly confirmedContext: boolean;
  /** Generation mode — always 'mock' or 'deterministic' in Phase 4-4-B. */
  readonly mode: 'mock' | 'deterministic';
}

/** Warning attached to a SlidePlan generation result. */
export interface SlidePlanGenerationWarning {
  readonly code: string;
  readonly message: string;
}

/** Error that prevented SlidePlan generation. */
export interface SlidePlanGenerationError {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
}

/** Observability report for SlidePlan generation. */
export interface SlidePlanGenerationReport {
  /** The request ID this report corresponds to. */
  readonly requestId: string;
  /** Presentation topic. */
  readonly topic: string;
  /** Number of selected source refs. */
  readonly sourceCount: number;
  /** Number of selected artifact refs. */
  readonly artifactCount: number;
  /** Whether user-provided content was supplied. */
  readonly hasUserProvidedContent: boolean;
  /** Total number of slides generated. */
  readonly totalSlides: number;
  /** Total number of content blocks across all slides. */
  readonly totalBlocks: number;
  /** Total SourceRefs across all slides. */
  readonly totalSourceRefs: number;
  /** Total EvidenceRefs across all slides. */
  readonly totalEvidenceRefs: number;
  /** Number of unsupported claims detected. */
  readonly unsupportedClaimCount: number;
  /** Section titles generated in the plan. */
  readonly generatedSections: readonly string[];
  /** Whether the slide count was limited by maxSlides. */
  readonly slideCountLimited: boolean;
  /** Always true in Phase 4-4-B — no real provider call. */
  readonly isMockGeneration: boolean;
  /** Always false — no real provider call. */
  readonly providerCalled: boolean;
  /** User must review before use. Always true. */
  readonly userReviewRequired: boolean;
  /** ISO timestamp of generation. */
  readonly generatedAt: string;
  /** Human-readable warning summaries. */
  readonly warnings: readonly string[];
}

/** Result of a SlidePlan generation attempt. */
export interface SlidePlanGenerationResult {
  /** Whether generation succeeded. */
  readonly ok: boolean;
  /** The generated slide plan (null on failure). */
  readonly plan: SlidePlan | null;
  /** The generated slide deck artifact (null on failure). */
  readonly deck: SlideDeckArtifact | null;
  /** Generation report for diagnostics. */
  readonly report: SlidePlanGenerationReport;
  /** Warnings accumulated during generation. */
  readonly warnings: readonly SlidePlanGenerationWarning[];
  /** Errors that prevented generation. */
  readonly errors: readonly SlidePlanGenerationError[];
  /** Always false — no real provider call in Phase 4-4-B. */
  readonly providerCalled: boolean;
  /** User must review before use. Always true. */
  readonly userReviewRequired: boolean;
}

// ── PPT Artifact Renderer Minimal (Phase 4-4-C) ──────────

/** Internal renderer target. Preview-only, no file export target. */
export type RenderTarget = 'preview_model' | 'html_fragment_mock';

/** Request to render an existing draft artifact into an internal preview model. */
export interface PPTArtifactRenderRequest {
  /** Unique request identifier. */
  readonly requestId: string;
  /** Existing draft slide deck or PPT wrapper to preview. */
  readonly artifact: SlideDeckArtifact | PPTArtifact;
  /** Internal preview target only. */
  readonly renderTarget: RenderTarget;
  /** Whether the user confirmed the artifact context before rendering. */
  readonly confirmedContext: boolean;
}

/** Preview-safe copy of a multimodal asset reference. */
export interface SlidePreviewAssetRef {
  /** Relative path inside the Vault only. */
  readonly relativePath: string;
  /** Asset type label for display. */
  readonly assetType: MultimodalAssetRef['assetType'];
  /** Alt text or caption. */
  readonly caption: string;
  /** SourceRefs backing the asset data. */
  readonly sources: readonly SourceRef[];
}

/** Preview-safe content block preserving source and evidence backing. */
export interface SlidePreviewBlock {
  /** Stable preview block ID. */
  readonly id: string;
  /** Type of content. */
  readonly blockType: SlideContentBlockType;
  /** Text or markdown content copied from the slide block. */
  readonly content: string;
  /** Ordered list items copied from the slide block. */
  readonly items: readonly string[];
  /** SourceRefs backing the factual claims in this block. */
  readonly sources: readonly SourceRef[];
  /** EvidenceRefs for specific factual claims. */
  readonly evidence: readonly EvidenceRef[];
  /** Preview-safe multimedia asset reference. */
  readonly assetRef: SlidePreviewAssetRef | null;
  /** Confidence score copied from the slide block. */
  readonly confidence: number;
  /** True when the block contains claims without source backing. */
  readonly hasUnsupportedClaims: boolean;
}

/** A single slide in the preview model. */
export interface SlidePreviewItem {
  /** Stable preview slide ID. */
  readonly id: string;
  /** Zero-based slide index. */
  readonly index: number;
  /** Slide title. */
  readonly title: string;
  /** Slide layout type. */
  readonly layout: SlideLayout;
  /** Ordered preview blocks. */
  readonly blocks: readonly SlidePreviewBlock[];
  /** Speaker notes copied from the source slide. */
  readonly notes: string;
  /** All SourceRefs across all blocks in this slide. */
  readonly allSources: readonly SourceRef[];
  /** All EvidenceRefs across all blocks in this slide. */
  readonly allEvidence: readonly EvidenceRef[];
  /** True if any block has unsupported claims. */
  readonly hasUnsupportedClaims: boolean;
}

/** Internal, serializable, preview-only representation of a slide deck. */
export interface SlidePreviewModel {
  /** The request ID this model was rendered for. */
  readonly requestId: string;
  /** Source deck artifact ID. */
  readonly deckId: string;
  /** Presentation title. */
  readonly title: string;
  /** Optional subtitle. */
  readonly subtitle: string;
  /** Draft status only. */
  readonly status: 'draft';
  /** Internal render target. */
  readonly renderTarget: RenderTarget;
  /** Ordered preview slides. */
  readonly slides: readonly SlidePreviewItem[];
  /** Total slide count. */
  readonly slideCount: number;
  /** Total SourceRefs across preview slides. */
  readonly totalSourceRefs: number;
  /** Total EvidenceRefs across preview slides. */
  readonly totalEvidenceRefs: number;
  /** Total asset refs across preview blocks. */
  readonly totalAssetRefs: number;
  /** Always true — renderer output is internal preview data only. */
  readonly previewOnly: boolean;
  /** Always true — renderer output is draft-only. */
  readonly draftOnly: boolean;
  /** Always false — no real provider call in Phase 4-4-C. */
  readonly providerCalled: boolean;
  /** User must review before use. Always true. */
  readonly userReviewRequired: boolean;
}

/** Warning attached to a PPT artifact render result. */
export interface PPTArtifactRenderWarning {
  readonly code: string;
  readonly message: string;
  readonly slideIndex?: number;
  readonly blockIndex?: number;
}

/** Error that prevented PPT artifact rendering. */
export interface PPTArtifactRenderError {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
  readonly slideIndex?: number;
  readonly blockIndex?: number;
  readonly assetRelativePath?: string;
}

/** Observability report for PPT artifact rendering. */
export interface PPTArtifactRenderReport {
  /** The request ID this report corresponds to. */
  readonly requestId: string;
  /** Source deck artifact ID, when available. */
  readonly deckId: string;
  /** Internal render target. */
  readonly renderTarget: RenderTarget;
  /** Total number of preview slides. */
  readonly totalSlides: number;
  /** Total number of preview blocks. */
  readonly totalBlocks: number;
  /** Total SourceRefs preserved in preview output. */
  readonly totalSourceRefs: number;
  /** Total EvidenceRefs preserved in preview output. */
  readonly totalEvidenceRefs: number;
  /** Total asset refs preserved in preview output. */
  readonly totalAssetRefs: number;
  /** Always true — renderer output is internal preview data only. */
  readonly previewOnly: boolean;
  /** Always true — renderer output is draft-only. */
  readonly draftOnly: boolean;
  /** Always false — no real provider call. */
  readonly providerCalled: boolean;
  /** User must review before use. Always true. */
  readonly userReviewRequired: boolean;
  /** ISO timestamp of rendering. */
  readonly renderedAt: string;
  /** Human-readable warning summaries. */
  readonly warnings: readonly string[];
}

/** Result of a PPT artifact render attempt. */
export interface PPTArtifactRenderResult {
  /** Whether rendering succeeded. */
  readonly ok: boolean;
  /** The preview model (null on failure). */
  readonly preview: SlidePreviewModel | null;
  /** Renderer report for diagnostics. */
  readonly report: PPTArtifactRenderReport;
  /** Warnings accumulated during rendering. */
  readonly warnings: readonly PPTArtifactRenderWarning[];
  /** Errors that prevented rendering. */
  readonly errors: readonly PPTArtifactRenderError[];
  /** Always false — no real provider call in Phase 4-4-C. */
  readonly providerCalled: boolean;
  /** User must review before use. Always true. */
  readonly userReviewRequired: boolean;
}

// ── Multimodal Asset Reference Guard (Phase 4-4-D) ───────

/** What the guard is validating against. */
export type AssetGuardTarget =
  | 'slide_deck'
  | 'ppt_artifact'
  | 'preview_model'
  | 'asset_list';

/** Guard operating mode. */
export type AssetGuardMode =
  | 'validate_only'
  | 'preview_safe';

/** Request to validate multimodal asset references. */
export interface MultimodalAssetGuardRequest {
  /** Unique request identifier. */
  readonly requestId: string;
  /** What is being validated. */
  readonly target: AssetGuardTarget;
  /** Guard operating mode. */
  readonly mode: AssetGuardMode;
  /** Slide deck artifact to validate (when target is slide_deck or ppt_artifact). */
  readonly deck?: SlideDeckArtifact;
  /** PPT artifact to validate (when target is ppt_artifact). */
  readonly pptArtifact?: PPTArtifact;
  /** Preview model to validate (when target is preview_model). */
  readonly previewModel?: SlidePreviewModel;
  /** Raw asset ref list to validate (when target is asset_list). */
  readonly assetRefs?: readonly MultimodalAssetRef[];
  /** Whether the user confirmed the context before guard invocation. */
  readonly confirmedContext: boolean;
}

/** Warning attached to a guard result. */
export interface MultimodalAssetGuardWarning {
  readonly code: string;
  readonly message: string;
  readonly slideIndex?: number;
  readonly blockIndex?: number;
  readonly assetRelativePath?: string;
}

/** Error that prevented guard execution. */
export interface MultimodalAssetGuardError {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
}

/** Observability report for asset guard execution. */
export interface MultimodalAssetGuardReport {
  /** The request ID this report corresponds to. */
  readonly requestId: string;
  /** Guard target that was validated. */
  readonly target: AssetGuardTarget;
  /** Guard operating mode. */
  readonly mode: AssetGuardMode;
  /** Total number of asset references checked. */
  readonly totalAssetRefs: number;
  /** Number of asset references that passed validation. */
  readonly passedRefs: number;
  /** Number of asset references with violations. */
  readonly violatedRefs: number;
  /** All violations found. */
  readonly violations: readonly AssetRefViolation[];
  /** Text summaries of guard-time warnings. */
  readonly warnings: readonly string[];
  /** Always true in guard output — preview-safe flag. */
  readonly previewSafe: boolean;
  /** Always true — guard never reads files. */
  readonly noFileRead: boolean;
  /** Always true — guard never writes files. */
  readonly noFileWrite: boolean;
  /** Always true — guard never processes images. */
  readonly noImageProcessing: boolean;
  /** Always true — guard never performs OCR. */
  readonly noOCR: boolean;
  /** Always false — no real provider call. */
  readonly providerCalled: boolean;
  /** Always false — no real embedding call. */
  readonly embeddingCalled: boolean;
  /** Always false — no external URL fetch. */
  readonly externalFetchCalled: boolean;
  /** ISO timestamp of guard execution. */
  readonly guardedAt: string;
}

/** Result of a multimodal asset guard invocation. */
export interface MultimodalAssetGuardResult {
  /** Whether all asset references passed validation. */
  readonly ok: boolean;
  /** Guard execution report. */
  readonly report: MultimodalAssetGuardReport;
  /** All violations found. */
  readonly violations: readonly AssetRefViolation[];
  /** Errors that prevented guard execution. */
  readonly errors: readonly MultimodalAssetGuardError[];
  /** Warnings accumulated during guard execution. */
  readonly warnings: readonly MultimodalAssetGuardWarning[];
  /** Always false — no real provider call in Phase 4-4-D. */
  readonly providerCalled: boolean;
  /** User must review before use. Always true. */
  readonly userReviewRequired: boolean;
}

/**
 * Create a minimal mock MultimodalAssetGuardRequest for testing.
 */
export function createMockGuardRequest(
  overrides?: Partial<MultimodalAssetGuardRequest>,
): MultimodalAssetGuardRequest {
  return {
    requestId: 'guard-req-001',
    target: 'slide_deck',
    mode: 'preview_safe',
    confirmedContext: true,
    ...overrides,
  };
}

// ── Artifact Preview / Export Bridge (Phase 4-4-E) ─────

/** Preview bridge output target — internal only, no export. */
export type ArtifactPreviewBridgeTarget =
  | 'slide_preview_model'
  | 'html_fragment_mock'
  | 'artifact_summary';

/** Export plan target — planning only, no file generation. */
export type ArtifactExportPlanTarget =
  | 'dry_run_pptx_plan'
  | 'dry_run_pdf_plan'
  | 'dry_run_image_plan';

/** Request to prepare an artifact for preview via the bridge. */
export interface ArtifactPreviewBridgeRequest {
  /** Unique request identifier. */
  readonly requestId: string;
  /** The preview model produced by the renderer. */
  readonly previewModel: SlidePreviewModel;
  /** Bridge-level preview target. */
  readonly target: ArtifactPreviewBridgeTarget;
  /** Whether the user confirmed the context. */
  readonly confirmedContext: boolean;
}

/** Warning attached to a bridge operation result. */
export interface ArtifactPreviewBridgeWarning {
  readonly code: string;
  readonly message: string;
}

/** Error that prevented bridge execution. */
export interface ArtifactPreviewBridgeError {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
}

/** Observability report for the preview bridge. */
export interface ArtifactPreviewBridgeReport {
  /** The request ID. */
  readonly requestId: string;
  /** Bridge-level preview target. */
  readonly target: ArtifactPreviewBridgeTarget;
  /** Total slides in the preview model. */
  readonly totalSlides: number;
  /** Total SourceRefs preserved. */
  readonly totalSourceRefs: number;
  /** Total EvidenceRefs preserved. */
  readonly totalEvidenceRefs: number;
  /** Total asset refs preserved. */
  readonly totalAssetRefs: number;
  /** Whether the preview model passed asset guard validation. */
  readonly guardPassed: boolean;
  /** Number of asset guard violations, if any. */
  readonly guardViolationCount: number;
  /** Whether the bridge output is preview-only. Always true. */
  readonly previewOnly: boolean;
  /** Whether the bridge output is draft-only. Always true. */
  readonly draftOnly: boolean;
  /** Always false — no provider call. */
  readonly providerCalled: boolean;
  /** User must review. Always true. */
  readonly userReviewRequired: boolean;
  /** ISO timestamp. */
  readonly bridgedAt: string;
  /** Human-readable warning summaries. */
  readonly warnings: readonly string[];
}

/** Result of a preview bridge invocation. */
export interface ArtifactPreviewBridgeResult {
  /** Whether the bridge operation succeeded. */
  readonly ok: boolean;
  /** The preview model (null on failure). */
  readonly previewModel: SlidePreviewModel | null;
  /** Bridge execution report. */
  readonly report: ArtifactPreviewBridgeReport;
  /** Warnings accumulated during bridge execution. */
  readonly warnings: readonly ArtifactPreviewBridgeWarning[];
  /** Errors that prevented bridge execution. */
  readonly errors: readonly ArtifactPreviewBridgeError[];
  /** Always false — no provider call. */
  readonly providerCalled: boolean;
  /** User must review. Always true. */
  readonly userReviewRequired: boolean;
}

/** A single item in a dry-run export plan. */
export interface ArtifactExportPlanItem {
  /** Slide index. */
  readonly slideIndex: number;
  /** Slide title. */
  readonly title: string;
  /** Number of content blocks on this slide. */
  readonly blockCount: number;
  /** Number of asset refs on this slide. */
  readonly assetRefCount: number;
  /** Whether all asset refs on this slide are preview-safe. */
  readonly assetsPreviewSafe: boolean;
}

/** A dry-run export plan — describes what would be exported without generating files. */
export interface ArtifactDryRunExportPlan {
  /** The request ID this plan corresponds to. */
  readonly requestId: string;
  /** Target export format (dry-run only). */
  readonly target: ArtifactExportPlanTarget;
  /** Deck artifact ID. */
  readonly deckId: string;
  /** Presentation title. */
  readonly title: string;
  /** Total slide count in the plan. */
  readonly totalSlides: number;
  /** Total content blocks across all slides. */
  readonly totalBlocks: number;
  /** Total asset refs across all slides. */
  readonly totalAssetRefs: number;
  /** Number of unsafe asset refs that would block export. */
  readonly unsafeAssetRefs: number;
  /** Whether the plan is eligible for export (all assets safe, no violations). */
  readonly exportEligible: boolean;
  /** Whether this is a dry-run only. Always true. */
  readonly dryRunOnly: boolean;
  /** Whether user review is required. Always true. */
  readonly userReviewRequired: boolean;
  /** Per-slide plan items. */
  readonly items: readonly ArtifactExportPlanItem[];
  /** Always false — no provider call. */
  readonly providerCalled: boolean;
  /** ISO timestamp. */
  readonly plannedAt: string;
}

/** Request to prepare a dry-run export plan. */
export interface ArtifactExportPlanRequest {
  /** Unique request identifier. */
  readonly requestId: string;
  /** The preview model to plan export for. */
  readonly previewModel: SlidePreviewModel;
  /** Dry-run export target. */
  readonly target: ArtifactExportPlanTarget;
  /** Whether the user confirmed the context. */
  readonly confirmedContext: boolean;
}

/** Observability report for export plan generation. */
export interface ArtifactExportPlanReport {
  /** The request ID. */
  readonly requestId: string;
  /** Dry-run export target. */
  readonly target: ArtifactExportPlanTarget;
  /** Total slides in the plan. */
  readonly totalSlides: number;
  /** Total blocks in the plan. */
  readonly totalBlocks: number;
  /** Total asset refs in the plan. */
  readonly totalAssetRefs: number;
  /** Unsafe asset ref count. */
  readonly unsafeAssetRefs: number;
  /** Whether the deck is export-eligible. */
  readonly exportEligible: boolean;
  /** Whether this is a dry-run only. Always true. */
  readonly dryRunOnly: boolean;
  /** Always false — no provider call. */
  readonly providerCalled: boolean;
  /** User must review. Always true. */
  readonly userReviewRequired: boolean;
  /** ISO timestamp. */
  readonly plannedAt: string;
  /** Human-readable warning summaries. */
  readonly warnings: readonly string[];
}

/** Result of an export plan generation attempt. */
export interface ArtifactExportPlanResult {
  /** Whether plan generation succeeded. */
  readonly ok: boolean;
  /** The dry-run export plan (null on failure). */
  readonly plan: ArtifactDryRunExportPlan | null;
  /** Execution report. */
  readonly report: ArtifactExportPlanReport;
  /** Warnings accumulated. */
  readonly warnings: readonly ArtifactPreviewBridgeWarning[];
  /** Errors that prevented plan generation. */
  readonly errors: readonly ArtifactPreviewBridgeError[];
  /** Always false — no provider call. */
  readonly providerCalled: boolean;
  /** User must review. Always true. */
  readonly userReviewRequired: boolean;
}

/**
 * Create a minimal mock ArtifactPreviewBridgeRequest for testing.
 */
export function createMockPreviewBridgeRequest(
  model: SlidePreviewModel,
  overrides?: Partial<ArtifactPreviewBridgeRequest>,
): ArtifactPreviewBridgeRequest {
  return {
    requestId: 'bridge-req-001',
    previewModel: model,
    target: 'slide_preview_model',
    confirmedContext: true,
    ...overrides,
  };
}

// ── AI Workbench Artifact Integration Minimal (Phase 4-4-F) ─────

/** Workbench-visible lifecycle status of an artifact. */
export type AIWorkbenchArtifactStatus =
  | 'draft'
  | 'preview_ready'
  | 'guard_blocked'
  | 'export_plan_ready'
  | 'export_ineligible';

/** Preview readiness state derived from renderer + guard results. */
export interface AIWorkbenchArtifactPreviewState {
  /** Whether a preview model is available. */
  readonly previewAvailable: boolean;
  /** Whether the asset guard passed (preview_safe). */
  readonly guardPassed: boolean;
  /** Number of asset guard violations. */
  readonly guardViolationCount: number;
  /** Whether the artifact can be previewed safely. */
  readonly previewSafe: boolean;
}

/** Dry-run export plan state derived from bridge results. */
export interface AIWorkbenchArtifactExportState {
  /** Whether an export plan is available. */
  readonly planAvailable: boolean;
  /** Whether the artifact is eligible for export. */
  readonly exportEligible: boolean;
  /** Number of unsafe asset refs blocking export. */
  readonly unsafeAssetRefs: number;
  /** Whether this is a dry-run only (always true). */
  readonly dryRunOnly: boolean;
}

/** A single artifact item displayed in the workbench artifact panel. */
export interface AIWorkbenchArtifactPanelItem {
  /** Artifact deck ID. */
  readonly deckId: string;
  /** Presentation title. */
  readonly title: string;
  /** Artifact status. */
  readonly status: AIWorkbenchArtifactStatus;
  /** Total slide count. */
  readonly slideCount: number;
  /** Total SourceRefs. */
  readonly totalSourceRefs: number;
  /** Total EvidenceRefs. */
  readonly totalEvidenceRefs: number;
  /** Total asset refs. */
  readonly totalAssetRefs: number;
  /** Preview state. */
  readonly preview: AIWorkbenchArtifactPreviewState;
  /** Export plan state. */
  readonly export: AIWorkbenchArtifactExportState;
}

/** The complete artifact panel model consumable by the AI Workbench UI. */
export interface AIWorkbenchArtifactPanelModel {
  /** Request ID. */
  readonly requestId: string;
  /** Ordered list of artifact panel items. */
  readonly items: readonly AIWorkbenchArtifactPanelItem[];
  /** Total artifacts in the panel. */
  readonly totalArtifacts: number;
  /** Number of preview-ready artifacts. */
  readonly previewReadyCount: number;
  /** Number of guard-blocked artifacts. */
  readonly guardBlockedCount: number;
  /** Number of export-plan-ready artifacts. */
  readonly exportPlanReadyCount: number;
  /** Always false — no provider call. */
  readonly providerCalled: boolean;
  /** User must review. Always true. */
  readonly userReviewRequired: boolean;
  /** Whether the user confirmed the context. */
  readonly contextConfirmed: boolean;
  /** ISO timestamp. */
  readonly generatedAt: string;
}

/** Request to integrate artifact data for AI Workbench consumption. */
export interface AIWorkbenchArtifactIntegrationRequest {
  /** Unique request identifier. */
  readonly requestId: string;
  /**
   * List of artifact descriptors. Each carries the minimum data produced
   * by the frozen artifact pipeline (renderer → guard → bridge).
   *
   * ⚠️  No providerModel, apiKey, embeddingModel, pptMasterEnabled,
   *    autoExport, writeToVault, or pluginRun fields.
   */
  readonly artifacts: readonly {
    /** The preview model from PPTArtifactRendererService. */
    readonly previewModel: SlidePreviewModel;
    /** Whether the asset guard passed (from MultimodalAssetGuardService). */
    readonly guardPassed: boolean;
    /** Number of guard violations. */
    readonly guardViolationCount: number;
    /** Whether an export plan is available (from bridge). */
    readonly exportPlanAvailable: boolean;
    /** Whether the export plan is eligible. */
    readonly exportEligible: boolean;
  }[];
  /** Whether the user confirmed the context. */
  readonly confirmedContext: boolean;
}

/** Warning attached to an AI Workbench integration result. */
export interface AIWorkbenchArtifactIntegrationWarning {
  readonly code: string;
  readonly message: string;
}

/** Error that prevented AI Workbench integration. */
export interface AIWorkbenchArtifactIntegrationError {
  readonly code: string;
  readonly message: string;
  readonly details?: string;
}

/** Observability report for AI Workbench integration. */
export interface AIWorkbenchArtifactIntegrationReport {
  /** The request ID. */
  readonly requestId: string;
  /** Number of artifacts processed. */
  readonly totalArtifacts: number;
  /** Number of preview-ready artifacts. */
  readonly previewReadyCount: number;
  /** Number of guard-blocked artifacts. */
  readonly guardBlockedCount: number;
  /** Number of export-plan-ready artifacts. */
  readonly exportPlanReadyCount: number;
  /** Number of export-ineligible artifacts. */
  readonly exportIneligibleCount: number;
  /** Always false — no provider call. */
  readonly providerCalled: boolean;
  /** User must review. Always true. */
  readonly userReviewRequired: boolean;
  /** Whether context was confirmed. */
  readonly contextConfirmed: boolean;
  /** ISO timestamp. */
  readonly generatedAt: string;
  /** Human-readable warning summaries. */
  readonly warnings: readonly string[];
}

/** Result of an AI Workbench integration attempt. */
export interface AIWorkbenchArtifactIntegrationResult {
  /** Whether integration succeeded. */
  readonly ok: boolean;
  /** The artifact panel model (null on failure). */
  readonly panel: AIWorkbenchArtifactPanelModel | null;
  /** Integration report. */
  readonly report: AIWorkbenchArtifactIntegrationReport;
  /** Warnings accumulated. */
  readonly warnings: readonly AIWorkbenchArtifactIntegrationWarning[];
  /** Errors that prevented integration. */
  readonly errors: readonly AIWorkbenchArtifactIntegrationError[];
  /** Always false — no provider call. */
  readonly providerCalled: boolean;
  /** User must review. Always true. */
  readonly userReviewRequired: boolean;
}

/**
 * Derive the workbench artifact status from preview + export state.
 * Pure function — no side effects, no network, no file access.
 */
export function deriveArtifactStatus(
  guardPassed: boolean,
  exportPlanAvailable: boolean,
  exportEligible: boolean,
): AIWorkbenchArtifactStatus {
  if (exportPlanAvailable && exportEligible) return 'export_plan_ready';
  if (exportPlanAvailable && !exportEligible) return 'export_ineligible';
  if (!guardPassed) return 'guard_blocked';
  return 'preview_ready';
}

/**
 * Create a minimal mock AIWorkbenchArtifactIntegrationRequest for testing.
 */
export function createMockIntegrationRequest(
  artifacts: AIWorkbenchArtifactIntegrationRequest['artifacts'],
  overrides?: Partial<AIWorkbenchArtifactIntegrationRequest>,
): AIWorkbenchArtifactIntegrationRequest {
  return {
    requestId: 'integration-req-001',
    artifacts,
    confirmedContext: true,
    ...overrides,
  };
}
