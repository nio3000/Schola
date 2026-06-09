/**
 * AIWorkbenchArtifactIntegrationService — Phase 4-4-F.
 *
 * Provides a minimal, deterministic integration layer between the frozen
 * artifact pipeline (renderer → asset guard → preview/export bridge) and
 * the future AI Workbench UI.
 *
 * This service is PURE and READ-ONLY: it only consumes already-generated data
 * and produces workbench-consumable artifact panel models. It performs zero
 * provider calls, embedding calls, network access, file I/O, IPC, or Vault
 * writes.
 *
 * Key invariants:
 * - draft-only: only draft artifacts are accepted
 * - artifact-first: the artifact panel model is the primary output
 * - source-backed / evidence-backed: SourceRef/EvidenceRef preserved throughout
 * - preview-safe: guard state faithfully reflected in preview state
 * - dry-run-only: export plan state marked dryRunOnly=true
 * - providerCalled=false: no real provider call
 * - userReviewRequired=true: user must review all outputs
 * - confirmedContext=true: context must be confirmed
 * - no PPT-master, no PowerPoint, no LibreOffice, no Pandoc, no pptxgenjs
 * - no generic IPC, no Vault write
 * - no Phase 5 plugin entry
 */
import type {
  AIWorkbenchArtifactIntegrationError,
  AIWorkbenchArtifactIntegrationReport,
  AIWorkbenchArtifactIntegrationRequest,
  AIWorkbenchArtifactIntegrationResult,
  AIWorkbenchArtifactIntegrationWarning,
  AIWorkbenchArtifactPanelItem,
  AIWorkbenchArtifactPanelModel,
  AIWorkbenchArtifactPreviewState,
  AIWorkbenchArtifactExportState,
  AIWorkbenchArtifactStatus,
  SlidePreviewModel,
} from '../../src/lib/contracts/ppt-artifact.types';
import { deriveArtifactStatus } from '../../src/lib/contracts/ppt-artifact.types';

// ── Constants ──────────────────────────────────────────

const ERROR_CODES = {
  EMPTY_REQUEST_ID: 'empty_request_id',
  CONTEXT_NOT_CONFIRMED: 'context_not_confirmed',
  NO_ARTIFACTS: 'no_artifacts',
  NON_DRAFT_MODEL: 'non_draft_model',
} as const;

const WARNING_CODES = {
  GUARD_BLOCKED_ARTIFACT: 'guard_blocked_artifact',
  EXPORT_INELIGIBLE_ARTIFACT: 'export_ineligible_artifact',
  UNSAFE_ASSETS_DETECTED: 'unsafe_assets_detected',
} as const;

// ── AIWorkbenchArtifactIntegrationService ──────────────

export class AIWorkbenchArtifactIntegrationService {
  /**
   * Integrate artifact data for AI Workbench consumption.
   *
   * Accepts a list of artifact descriptors (each carrying the minimum data
   * from the frozen pipeline) and produces an artifact panel model.
   */
  integrateArtifactForWorkbench(
    request: AIWorkbenchArtifactIntegrationRequest,
  ): AIWorkbenchArtifactIntegrationResult {
    const errors = this.validateIntegrationRequest(request);
    if (errors.length > 0) {
      return this.failureResult(request, errors);
    }

    const panel = this.buildArtifactPanelModel(request);
    const warnings = this.collectIntegrationWarnings(panel.items);
    const report = this.buildIntegrationReport(request, panel, warnings);

    return {
      ok: true,
      panel,
      report,
      warnings,
      errors: [],
      providerCalled: false,
      userReviewRequired: true,
    };
  }

  /**
   * Validate the integration request.
   * Checks: requestId, confirmedContext, non-empty artifacts, draft status.
   */
  validateIntegrationRequest(
    request: AIWorkbenchArtifactIntegrationRequest,
  ): AIWorkbenchArtifactIntegrationError[] {
    const errors: AIWorkbenchArtifactIntegrationError[] = [];

    if (!request.requestId || request.requestId.trim().length === 0) {
      errors.push({
        code: ERROR_CODES.EMPTY_REQUEST_ID,
        message: 'requestId is required and must not be empty.',
      });
    }

    if (!request.confirmedContext) {
      errors.push({
        code: ERROR_CODES.CONTEXT_NOT_CONFIRMED,
        message: 'Context must be confirmed by the user before integration.',
      });
    }

    if (request.artifacts.length === 0) {
      errors.push({
        code: ERROR_CODES.NO_ARTIFACTS,
        message: 'At least one artifact is required for integration.',
      });
    }

    for (const artifact of request.artifacts) {
      if (artifact.previewModel.status !== 'draft') {
        errors.push({
          code: ERROR_CODES.NON_DRAFT_MODEL,
          message: 'Only draft artifacts can be integrated.',
          details: `Deck "${artifact.previewModel.deckId}" has status "${artifact.previewModel.status}".`,
        });
      }
    }

    // Deduplicate errors so multiple non-draft artifacts only produce one error type
    const uniqueCodes = new Set(errors.map((e) => e.code));
    if (uniqueCodes.size < errors.length) {
      return errors.filter(
        (e, i) => i === errors.findIndex((first) => first.code === e.code),
      );
    }
    return errors;
  }

  /**
   * Build the complete artifact panel model from the request artifacts.
   */
  buildArtifactPanelModel(
    request: AIWorkbenchArtifactIntegrationRequest,
  ): AIWorkbenchArtifactPanelModel {
    const items = request.artifacts.map((artifact) =>
      this.buildArtifactPanelItem(artifact),
    );

    const previewReadyCount = items.filter((i) => i.status === 'preview_ready').length;
    const guardBlockedCount = items.filter((i) => i.status === 'guard_blocked').length;
    const exportPlanReadyCount = items.filter(
      (i) => i.status === 'export_plan_ready',
    ).length;

    return {
      requestId: request.requestId,
      items,
      totalArtifacts: items.length,
      previewReadyCount,
      guardBlockedCount,
      exportPlanReadyCount,
      providerCalled: false,
      userReviewRequired: true,
      contextConfirmed: request.confirmedContext,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build a single artifact panel item from an artifact descriptor.
   */
  buildArtifactPanelItem(artifact: AIWorkbenchArtifactIntegrationRequest['artifacts'][number]): AIWorkbenchArtifactPanelItem {
    const model = artifact.previewModel;
    const status = this.derivePanelStatus(artifact);
    const preview = this.derivePreviewState(artifact);
    const exportState = this.deriveExportState(artifact);

    return {
      deckId: model.deckId,
      title: model.title,
      status,
      slideCount: model.slideCount,
      totalSourceRefs: model.totalSourceRefs,
      totalEvidenceRefs: model.totalEvidenceRefs,
      totalAssetRefs: model.totalAssetRefs,
      preview,
      export: exportState,
    };
  }

  /**
   * Derive the workbench-visible status for an artifact.
   */
  derivePanelStatus(
    artifact: AIWorkbenchArtifactIntegrationRequest['artifacts'][number],
  ): AIWorkbenchArtifactStatus {
    return deriveArtifactStatus(
      artifact.guardPassed,
      artifact.exportPlanAvailable,
      artifact.exportEligible,
    );
  }

  /**
   * Derive the preview readiness state.
   */
  derivePreviewState(
    artifact: AIWorkbenchArtifactIntegrationRequest['artifacts'][number],
  ): AIWorkbenchArtifactPreviewState {
    return {
      previewAvailable: artifact.previewModel.slides.length > 0,
      guardPassed: artifact.guardPassed,
      guardViolationCount: artifact.guardViolationCount,
      previewSafe: artifact.guardPassed,
    };
  }

  /**
   * Derive the dry-run export plan state.
   * Always marks dryRunOnly=true — no real export.
   */
  deriveExportState(
    artifact: AIWorkbenchArtifactIntegrationRequest['artifacts'][number],
  ): AIWorkbenchArtifactExportState {
    return {
      planAvailable: artifact.exportPlanAvailable,
      exportEligible: artifact.exportEligible,
      unsafeAssetRefs: artifact.guardViolationCount,
      dryRunOnly: true,
    };
  }

  // ════════════════════════════════════════════════════════
  // Reports
  // ════════════════════════════════════════════════════════

  /** Build the integration observability report. */
  buildIntegrationReport(
    request: AIWorkbenchArtifactIntegrationRequest,
    panel: AIWorkbenchArtifactPanelModel,
    warnings: readonly AIWorkbenchArtifactIntegrationWarning[],
  ): AIWorkbenchArtifactIntegrationReport {
    return {
      requestId: request.requestId,
      totalArtifacts: panel.totalArtifacts,
      previewReadyCount: panel.previewReadyCount,
      guardBlockedCount: panel.guardBlockedCount,
      exportPlanReadyCount: panel.exportPlanReadyCount,
      exportIneligibleCount:
        panel.totalArtifacts -
        panel.previewReadyCount -
        panel.guardBlockedCount -
        panel.exportPlanReadyCount,
      providerCalled: false,
      userReviewRequired: true,
      contextConfirmed: request.confirmedContext,
      generatedAt: panel.generatedAt,
      warnings: warnings.map((w) => w.message),
    };
  }

  // ════════════════════════════════════════════════════════
  // Warnings & Errors
  // ════════════════════════════════════════════════════════

  /** Collect warnings from the artifact panel items. */
  collectIntegrationWarnings(
    items: readonly AIWorkbenchArtifactPanelItem[],
  ): AIWorkbenchArtifactIntegrationWarning[] {
    const warnings: AIWorkbenchArtifactIntegrationWarning[] = [];

    for (const item of items) {
      if (item.status === 'guard_blocked') {
        warnings.push({
          code: WARNING_CODES.GUARD_BLOCKED_ARTIFACT,
          message: `Artifact "${item.title}" is guard-blocked and cannot be previewed safely.`,
        });
      }
      if (item.status === 'export_ineligible') {
        warnings.push({
          code: WARNING_CODES.EXPORT_INELIGIBLE_ARTIFACT,
          message: `Artifact "${item.title}" has an export plan but is not eligible for real export.`,
        });
      }
      if (item.export.unsafeAssetRefs > 0) {
        warnings.push({
          code: WARNING_CODES.UNSAFE_ASSETS_DETECTED,
          message: `Artifact "${item.title}" has ${item.export.unsafeAssetRefs} unsafe asset reference(s).`,
        });
      }
    }

    return warnings;
  }

  /**
   * Aggregate integration-level errors into a flat list.
   */
  aggregateIntegrationErrors(
    ...errorLists: readonly AIWorkbenchArtifactIntegrationError[][]
  ): AIWorkbenchArtifactIntegrationError[] {
    return errorLists.flat();
  }

  // ════════════════════════════════════════════════════════
  // Private Helpers
  // ════════════════════════════════════════════════════════

  /** Build a failure result when the request is invalid. */
  private failureResult(
    request: AIWorkbenchArtifactIntegrationRequest,
    errors: readonly AIWorkbenchArtifactIntegrationError[],
  ): AIWorkbenchArtifactIntegrationResult {
    const report: AIWorkbenchArtifactIntegrationReport = {
      requestId: request.requestId,
      totalArtifacts: 0,
      previewReadyCount: 0,
      guardBlockedCount: 0,
      exportPlanReadyCount: 0,
      exportIneligibleCount: 0,
      providerCalled: false,
      userReviewRequired: true,
      contextConfirmed: request.confirmedContext,
      generatedAt: new Date().toISOString(),
      warnings: [],
    };

    return {
      ok: false,
      panel: null,
      report,
      warnings: [],
      errors: [...errors],
      providerCalled: false,
      userReviewRequired: true,
    };
  }
}
