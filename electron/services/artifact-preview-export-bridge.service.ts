/**
 * ArtifactPreviewExportBridgeService — Phase 4-4-E.
 *
 * Provides a minimal, deterministic bridge between the artifact pipeline
 * (renderer, asset guard) and future UI / export capabilities.
 *
 * This bridge produces ONLY:
 * - Preview bridge models (aggregates renderer output + guard validation)
 * - Dry-run export plans (describes what would be exported, without generating files)
 *
 * Key invariants:
 * - preview-only / draft-only: no real export, no file generation
 * - dry-run export plan: describes but does not produce files
 * - preview-safe asset guard required: unsafe asset refs block preview-safe bridge
 * - SourceRef / EvidenceRef preservation throughout
 * - relativePath-only safe asset refs preserved
 * - no file read/write, no shell open/reveal
 * - no PowerPoint / LibreOffice / Pandoc / pptxgenjs
 * - no PPT-master reference or integration
 * - no provider call, no embedding call, no external fetch
 * - no generic IPC, no Vault write
 * - no Phase 5 plugin entry
 */
import { MultimodalAssetGuardService } from './multimodal-asset-guard.service';
import type {
  ArtifactDryRunExportPlan,
  ArtifactExportPlanItem,
  ArtifactExportPlanReport,
  ArtifactExportPlanRequest,
  ArtifactExportPlanResult,
  ArtifactExportPlanTarget,
  ArtifactPreviewBridgeError,
  ArtifactPreviewBridgeReport,
  ArtifactPreviewBridgeRequest,
  ArtifactPreviewBridgeResult,
  ArtifactPreviewBridgeTarget,
  ArtifactPreviewBridgeWarning,
  MultimodalAssetGuardRequest,
  SlidePreviewModel,
} from '../../src/lib/contracts/ppt-artifact.types';

// ── Constants ──────────────────────────────────────────

const ERROR_CODES = {
  EMPTY_REQUEST_ID: 'empty_request_id',
  CONTEXT_NOT_CONFIRMED: 'context_not_confirmed',
  NON_DRAFT_MODEL: 'non_draft_model',
  ASSET_GUARD_FAILED_PREVIEW: 'asset_guard_failed_preview',
  EMPTY_PREVIEW_MODEL: 'empty_preview_model',
} as const;

const WARNING_CODES = {
  UNSAFE_ASSETS_DETECTED: 'unsafe_assets_detected',
  UNSUPPORTED_CLAIMS_PRESENT: 'unsupported_claims_present',
  ZERO_SLIDES: 'zero_slides',
} as const;

// ── ArtifactPreviewExportBridgeService ─────────────────

export class ArtifactPreviewExportBridgeService {
  private readonly assetGuard = new MultimodalAssetGuardService();

  // ════════════════════════════════════════════════════════
  // Preview Bridge
  // ════════════════════════════════════════════════════════

  /**
   * Prepare an artifact for preview via the bridge.
   *
   * Validates the request, runs the asset guard, and produces a bridge-level
   * preview model with guard validation results.
   */
  prepareArtifactPreview(
    request: ArtifactPreviewBridgeRequest,
  ): ArtifactPreviewBridgeResult {
    const errors = this.validatePreviewRequest(request);
    if (errors.length > 0) {
      return this.previewFailureResult(request, errors);
    }

    const model = request.previewModel;

    // Run asset guard in preview_safe mode
    const guardRequest: MultimodalAssetGuardRequest = {
      requestId: `guard-${request.requestId}`,
      target: 'preview_model',
      mode: 'preview_safe',
      previewModel: model,
      confirmedContext: true,
    };
    const guardResult = this.assetGuard.validateAssetReferences(guardRequest);

    // If guard fails in preview_safe mode, block the preview
    if (!guardResult.ok) {
      errors.push({
        code: ERROR_CODES.ASSET_GUARD_FAILED_PREVIEW,
        message: 'Asset guard validation failed. Unsafe asset references detected.',
        details: `${guardResult.violations.length} violation(s) found.`,
      });
      return this.previewFailureResult(request, errors);
    }

    const warnings = this.collectPreviewWarnings(model, guardResult);
    const report = this.buildPreviewReport(request, model, guardResult, warnings);

    return {
      ok: true,
      previewModel: model,
      report,
      warnings,
      errors: [],
      providerCalled: false,
      userReviewRequired: true,
    };
  }

  /**
   * Validate the preview request before proceeding.
   * Checks: requestId, confirmedContext, draft status.
   */
  validatePreviewRequest(
    request: ArtifactPreviewBridgeRequest,
  ): ArtifactPreviewBridgeError[] {
    const errors: ArtifactPreviewBridgeError[] = [];

    if (!request.requestId || request.requestId.trim().length === 0) {
      errors.push({
        code: ERROR_CODES.EMPTY_REQUEST_ID,
        message: 'requestId is required and must not be empty.',
      });
    }

    if (!request.confirmedContext) {
      errors.push({
        code: ERROR_CODES.CONTEXT_NOT_CONFIRMED,
        message: 'Context must be confirmed by the user before preview bridging.',
      });
    }

    if (request.previewModel.status !== 'draft') {
      errors.push({
        code: ERROR_CODES.NON_DRAFT_MODEL,
        message: 'Only draft preview models can be bridged for preview.',
        details: `Received status: ${request.previewModel.status}.`,
      });
    }

    if (request.previewModel.slides.length === 0) {
      errors.push({
        code: ERROR_CODES.EMPTY_PREVIEW_MODEL,
        message: 'Preview model contains no slides.',
      });
    }

    return errors;
  }

  /**
   * Build the bridge-level preview model wrapper.
   */
  buildPreviewBridgeModel(model: SlidePreviewModel): SlidePreviewModel {
    // The bridge preserves the renderer's preview model as-is
    return model;
  }

  /**
   * Validate preview-safe assets by delegating to the MultimodalAssetGuardService.
   * Returns true if all asset references pass the preview_safe guard.
   */
  validatePreviewSafeAssets(model: SlidePreviewModel): boolean {
    const guardRequest: MultimodalAssetGuardRequest = {
      requestId: 'guard-asset-check',
      target: 'preview_model',
      mode: 'preview_safe',
      previewModel: model,
      confirmedContext: true,
    };
    const guardResult = this.assetGuard.validateAssetReferences(guardRequest);
    return guardResult.ok;
  }

  // ════════════════════════════════════════════════════════
  // Export Plan
  // ════════════════════════════════════════════════════════

  /**
   * Prepare a dry-run export plan.
   *
   * Validates export eligibility, runs the asset guard, and produces a plan
   * describing what would be exported — without generating any files.
   */
  prepareExportPlan(
    request: ArtifactExportPlanRequest,
  ): ArtifactExportPlanResult {
    const errors = this.validateExportEligibility(request);
    if (errors.length > 0) {
      return this.exportPlanFailureResult(request, errors);
    }

    const model = request.previewModel;

    // Run asset guard in preview_safe mode to check all assets
    const guardRequest: MultimodalAssetGuardRequest = {
      requestId: `guard-export-${request.requestId}`,
      target: 'preview_model',
      mode: 'preview_safe',
      previewModel: model,
      confirmedContext: true,
    };
    const guardResult = this.assetGuard.validateAssetReferences(guardRequest);

    const plan = this.buildDryRunExportPlan(request, model, guardResult);
    const warnings = this.collectExportPlanWarnings(model, guardResult);
    const report = this.buildExportPlanReport(request, plan, warnings);

    return {
      ok: true,
      plan,
      report,
      warnings,
      errors: [],
      providerCalled: false,
      userReviewRequired: true,
    };
  }

  /**
   * Validate that the artifact is eligible for export planning.
   * Checks: requestId, confirmedContext, draft status, non-empty slides.
   */
  validateExportEligibility(
    request: ArtifactExportPlanRequest,
  ): ArtifactPreviewBridgeError[] {
    const errors: ArtifactPreviewBridgeError[] = [];

    if (!request.requestId || request.requestId.trim().length === 0) {
      errors.push({
        code: ERROR_CODES.EMPTY_REQUEST_ID,
        message: 'requestId is required and must not be empty.',
      });
    }

    if (!request.confirmedContext) {
      errors.push({
        code: ERROR_CODES.CONTEXT_NOT_CONFIRMED,
        message: 'Context must be confirmed by the user before export planning.',
      });
    }

    if (request.previewModel.status !== 'draft') {
      errors.push({
        code: ERROR_CODES.NON_DRAFT_MODEL,
        message: 'Only draft artifacts can be processed for export planning.',
        details: `Received status: ${request.previewModel.status}.`,
      });
    }

    if (request.previewModel.slides.length === 0) {
      errors.push({
        code: ERROR_CODES.EMPTY_PREVIEW_MODEL,
        message: 'Cannot plan export for a preview model with zero slides.',
      });
    }

    return errors;
  }

  /**
   * Build a dry-run export plan — describes what would be exported
   * WITHOUT generating any files or calling any external tools.
   */
  buildDryRunExportPlan(
    request: ArtifactExportPlanRequest,
    model: SlidePreviewModel,
    guardResult: { violations: readonly { reason: string }[]; ok: boolean },
  ): ArtifactDryRunExportPlan {
    const unsafeCount = guardResult.violations.length;
    const items: ArtifactExportPlanItem[] = model.slides.map((slide) => {
      let assetRefCount = 0;
      let assetBlockCount = 0;
      for (const block of slide.blocks) {
        if (block.assetRef) {
          assetRefCount++;
          assetBlockCount++;
        }
      }
      return {
        slideIndex: slide.index,
        title: slide.title,
        blockCount: slide.blocks.length,
        assetRefCount,
        assetsPreviewSafe: guardResult.ok,
      };
    });

    return {
      requestId: request.requestId,
      target: request.target,
      deckId: model.deckId,
      title: model.title,
      totalSlides: model.slideCount,
      totalBlocks: model.slides.reduce((sum, s) => sum + s.blocks.length, 0),
      totalAssetRefs: model.totalAssetRefs,
      unsafeAssetRefs: unsafeCount,
      exportEligible: guardResult.ok,
      dryRunOnly: true,
      userReviewRequired: true,
      items,
      providerCalled: false,
      plannedAt: new Date().toISOString(),
    };
  }

  // ════════════════════════════════════════════════════════
  // Reports
  // ════════════════════════════════════════════════════════

  /** Build the preview bridge observability report. */
  buildPreviewReport(
    request: ArtifactPreviewBridgeRequest,
    model: SlidePreviewModel,
    guardResult: {
      violations: readonly { reason: string }[];
      ok: boolean;
    },
    warnings: readonly ArtifactPreviewBridgeWarning[],
  ): ArtifactPreviewBridgeReport {
    return {
      requestId: request.requestId,
      target: request.target,
      totalSlides: model.slideCount,
      totalSourceRefs: model.totalSourceRefs,
      totalEvidenceRefs: model.totalEvidenceRefs,
      totalAssetRefs: model.totalAssetRefs,
      guardPassed: guardResult.ok,
      guardViolationCount: guardResult.violations.length,
      previewOnly: true,
      draftOnly: true,
      providerCalled: false,
      userReviewRequired: true,
      bridgedAt: new Date().toISOString(),
      warnings: warnings.map((w) => w.message),
    };
  }

  /** Build the export plan observability report. */
  buildExportPlanReport(
    request: ArtifactExportPlanRequest,
    plan: ArtifactDryRunExportPlan,
    warnings: readonly ArtifactPreviewBridgeWarning[],
  ): ArtifactExportPlanReport {
    return {
      requestId: request.requestId,
      target: request.target,
      totalSlides: plan.totalSlides,
      totalBlocks: plan.totalBlocks,
      totalAssetRefs: plan.totalAssetRefs,
      unsafeAssetRefs: plan.unsafeAssetRefs,
      exportEligible: plan.exportEligible,
      dryRunOnly: true,
      providerCalled: false,
      userReviewRequired: true,
      plannedAt: plan.plannedAt,
      warnings: warnings.map((w) => w.message),
    };
  }

  /**
   * Build a combined preview/export observability report.
   * Convenience method that delegates to the specific report builders.
   */
  buildPreviewExportReport(
    request: ArtifactPreviewBridgeRequest | ArtifactExportPlanRequest,
    model: SlidePreviewModel,
    guardResult: {
      violations: readonly { reason: string }[];
      ok: boolean;
    },
    warnings: readonly ArtifactPreviewBridgeWarning[],
  ): ArtifactPreviewBridgeReport | ArtifactExportPlanReport {
    if ('previewModel' in request && 'target' in request) {
      return this.buildPreviewReport(
        request as ArtifactPreviewBridgeRequest,
        model,
        guardResult,
        warnings,
      );
    }
    const plan = this.buildDryRunExportPlan(
      request as ArtifactExportPlanRequest,
      model,
      guardResult,
    );
    return this.buildExportPlanReport(
      request as ArtifactExportPlanRequest,
      plan,
      warnings,
    );
  }

  // ════════════════════════════════════════════════════════
  // Warnings & Errors
  // ════════════════════════════════════════════════════════

  /** Collect preview bridge warnings. */
  collectPreviewWarnings(
    model: SlidePreviewModel,
    guardResult: {
      violations: readonly { reason: string }[];
      ok: boolean;
    },
  ): ArtifactPreviewBridgeWarning[] {
    const warnings: ArtifactPreviewBridgeWarning[] = [];

    if (model.slides.length === 0) {
      warnings.push({
        code: WARNING_CODES.ZERO_SLIDES,
        message: 'Preview model contains zero slides.',
      });
    }

    if (!guardResult.ok) {
      warnings.push({
        code: WARNING_CODES.UNSAFE_ASSETS_DETECTED,
        message: `${guardResult.violations.length} unsafe asset reference(s) detected.`,
      });
    }

    const hasUnsupported = model.slides.some((s) => s.hasUnsupportedClaims);
    if (hasUnsupported) {
      warnings.push({
        code: WARNING_CODES.UNSUPPORTED_CLAIMS_PRESENT,
        message: 'Some slides contain unsupported claims and require manual review.',
      });
    }

    return warnings;
  }

  /** Collect export plan warnings. */
  collectExportPlanWarnings(
    model: SlidePreviewModel,
    guardResult: {
      violations: readonly { reason: string }[];
      ok: boolean;
    },
  ): ArtifactPreviewBridgeWarning[] {
    const warnings: ArtifactPreviewBridgeWarning[] = [];

    if (model.slides.length === 0) {
      warnings.push({
        code: WARNING_CODES.ZERO_SLIDES,
        message: 'Cannot plan export for an empty deck.',
      });
    }

    if (!guardResult.ok) {
      warnings.push({
        code: WARNING_CODES.UNSAFE_ASSETS_DETECTED,
        message: `${guardResult.violations.length} unsafe asset reference(s) detected — export plan marked not eligible.`,
      });
    }

    return warnings;
  }

  /**
   * Aggregate bridge-level errors into a flat list.
   */
  aggregatePreviewExportErrors(
    ...errorLists: readonly ArtifactPreviewBridgeError[][]
  ): ArtifactPreviewBridgeError[] {
    return errorLists.flat();
  }

  // ════════════════════════════════════════════════════════
  // Private Helpers
  // ════════════════════════════════════════════════════════

  /** Build a failure result for preview bridge. */
  private previewFailureResult(
    request: ArtifactPreviewBridgeRequest,
    errors: readonly ArtifactPreviewBridgeError[],
  ): ArtifactPreviewBridgeResult {
    const report: ArtifactPreviewBridgeReport = {
      requestId: request.requestId,
      target: request.target,
      totalSlides: 0,
      totalSourceRefs: 0,
      totalEvidenceRefs: 0,
      totalAssetRefs: 0,
      guardPassed: false,
      guardViolationCount: 0,
      previewOnly: true,
      draftOnly: true,
      providerCalled: false,
      userReviewRequired: true,
      bridgedAt: new Date().toISOString(),
      warnings: [],
    };

    return {
      ok: false,
      previewModel: null,
      report,
      warnings: [],
      errors: [...errors],
      providerCalled: false,
      userReviewRequired: true,
    };
  }

  /** Build a failure result for export plan. */
  private exportPlanFailureResult(
    request: ArtifactExportPlanRequest,
    errors: readonly ArtifactPreviewBridgeError[],
  ): ArtifactExportPlanResult {
    const report: ArtifactExportPlanReport = {
      requestId: request.requestId,
      target: request.target,
      totalSlides: 0,
      totalBlocks: 0,
      totalAssetRefs: 0,
      unsafeAssetRefs: 0,
      exportEligible: false,
      dryRunOnly: true,
      providerCalled: false,
      userReviewRequired: true,
      plannedAt: new Date().toISOString(),
      warnings: [],
    };

    return {
      ok: false,
      plan: null,
      report,
      warnings: [],
      errors: [...errors],
      providerCalled: false,
      userReviewRequired: true,
    };
  }
}
