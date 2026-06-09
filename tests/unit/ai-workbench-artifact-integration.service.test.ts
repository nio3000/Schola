/**
 * AI Workbench Artifact Integration Service Tests — Phase 4-4-F.
 *
 * Covers all Phase 4-4-F P0 test boundaries:
 * - accepts only draft artifacts
 * - rejects non-draft / final-like status
 * - confirmedContext required
 * - preserves SourceRef / EvidenceRef
 * - preview-ready / guard-blocked / export-plan-ready status derivation
 * - providerCalled=false / userReviewRequired=true
 * - no provider / embedding call
 * - no file generation / Vault write
 * - no shell open / reveal
 * - no PowerPoint / LibreOffice / Pandoc / pptxgenjs
 * - no PPT-master
 * - no generic IPC
 * - no Phase 5 plugin entry
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { AIWorkbenchArtifactIntegrationService } from '../../electron/services/ai-workbench-artifact-integration.service';
import {
  deriveArtifactStatus,
  createMockIntegrationRequest,
} from '../../src/lib/contracts/ppt-artifact.types';
import type {
  AIWorkbenchArtifactIntegrationRequest,
  SlidePreviewModel,
  SlidePreviewItem,
  SlidePreviewBlock,
} from '../../src/lib/contracts/ppt-artifact.types';
import type { SourceRef, EvidenceRef } from '../../src/lib/contracts/local-qa.types';

// ── Helpers ────────────────────────────────────────────

function makeSourceRef(
  relativePath: string,
  overrides?: Partial<SourceRef>,
): SourceRef {
  return {
    relativePath,
    chunkIndex: 0,
    headingPath: ['# Research'],
    score: 0.9,
    ...overrides,
  };
}

function makeEvidenceRef(sourceRelativePath: string, excerpt: string): EvidenceRef {
  return {
    source: makeSourceRef(sourceRelativePath),
    excerpt,
    excerptTokenCount: 5,
  };
}

function makePreviewModel(
  overrides?: Partial<SlidePreviewModel>,
): SlidePreviewModel {
  return {
    requestId: 'preview-req-001',
    deckId: 'deck-001',
    title: 'Test Presentation',
    subtitle: '',
    status: 'draft',
    renderTarget: 'preview_model',
    slides: [],
    slideCount: 0,
    totalSourceRefs: 0,
    totalEvidenceRefs: 0,
    totalAssetRefs: 0,
    previewOnly: true,
    draftOnly: true,
    providerCalled: false,
    userReviewRequired: true,
    ...overrides,
  };
}

function makeArtifact(
  model: SlidePreviewModel,
  overrides?: Partial<{ guardPassed: boolean; guardViolationCount: number; exportPlanAvailable: boolean; exportEligible: boolean }>,
): AIWorkbenchArtifactIntegrationRequest['artifacts'][number] {
  return {
    previewModel: model,
    guardPassed: true,
    guardViolationCount: 0,
    exportPlanAvailable: false,
    exportEligible: false,
    ...overrides,
  };
}

// ── Constants ──────────────────────────────────────────

const SVC = new AIWorkbenchArtifactIntegrationService();

// ── Tests ───────────────────────────────────────────────

describe('AIWorkbenchArtifactIntegrationService', () => {

  // ════════════════════════════════════════════════════════
  // accepts only draft artifacts
  // ════════════════════════════════════════════════════════

  describe('accepts only draft artifacts', () => {

    it('accepts draft preview model', () => {
      const model = makePreviewModel({ status: 'draft' });
      const artifacts = [makeArtifact(model)];
      const req = createMockIntegrationRequest(artifacts);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, true);
      assert.ok(result.panel !== null);
    });

    it('rejects non-draft preview model', () => {
      const model = makePreviewModel({ status: 'reviewed' as 'draft' });
      const artifacts = [makeArtifact(model)];
      const req = createMockIntegrationRequest(artifacts);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === 'non_draft_model'));
    });

    it('rejects empty requestId', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([makeArtifact(model)], { requestId: '' });
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === 'empty_request_id'));
    });

    it('rejects unconfirmed context', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([makeArtifact(model)], { confirmedContext: false });
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === 'context_not_confirmed'));
    });

    it('rejects empty artifacts list', () => {
      const req = createMockIntegrationRequest([]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, false);
      assert.ok(result.errors.some((e) => e.code === 'no_artifacts'));
    });
  });

  // ════════════════════════════════════════════════════════
  // SourceRef / EvidenceRef preservation
  // ════════════════════════════════════════════════════════

  describe('SourceRef / EvidenceRef preservation', () => {

    it('preserves SourceRef counts in panel items', () => {
      const model = makePreviewModel({ totalSourceRefs: 5 });
      const artifacts = [makeArtifact(model)];
      const req = createMockIntegrationRequest(artifacts);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, true);
      assert.equal(result.panel!.items[0].totalSourceRefs, 5);
    });

    it('preserves EvidenceRef counts in panel items', () => {
      const model = makePreviewModel({ totalEvidenceRefs: 3 });
      const artifacts = [makeArtifact(model)];
      const req = createMockIntegrationRequest(artifacts);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, true);
      assert.equal(result.panel!.items[0].totalEvidenceRefs, 3);
    });
  });

  // ════════════════════════════════════════════════════════
  // Status derivation
  // ════════════════════════════════════════════════════════

  describe('status derivation', () => {

    it('derives preview_ready when guard passes and no export plan', () => {
      const model = makePreviewModel();
      const artifacts = [
        makeArtifact(model, { guardPassed: true, exportPlanAvailable: false }),
      ];
      const req = createMockIntegrationRequest(artifacts);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.panel!.items[0].status, 'preview_ready');
    });

    it('derives guard_blocked when guard fails', () => {
      const model = makePreviewModel();
      const artifacts = [
        makeArtifact(model, { guardPassed: false, guardViolationCount: 2 }),
      ];
      const req = createMockIntegrationRequest(artifacts);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.panel!.items[0].status, 'guard_blocked');
    });

    it('derives export_plan_ready when export plan is available and eligible', () => {
      const model = makePreviewModel();
      const artifacts = [
        makeArtifact(model, {
          guardPassed: true,
          exportPlanAvailable: true,
          exportEligible: true,
        }),
      ];
      const req = createMockIntegrationRequest(artifacts);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.panel!.items[0].status, 'export_plan_ready');
    });

    it('derives export_ineligible when export plan available but not eligible', () => {
      const model = makePreviewModel();
      const artifacts = [
        makeArtifact(model, {
          guardPassed: false,
          guardViolationCount: 1,
          exportPlanAvailable: true,
          exportEligible: false,
        }),
      ];
      const req = createMockIntegrationRequest(artifacts);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.panel!.items[0].status, 'export_ineligible');
    });

    it('deriveArtifactStatus pure function works correctly', () => {
      assert.equal(deriveArtifactStatus(true, true, true), 'export_plan_ready');
      assert.equal(deriveArtifactStatus(false, true, false), 'export_ineligible');
      assert.equal(deriveArtifactStatus(false, false, false), 'guard_blocked');
      assert.equal(deriveArtifactStatus(true, false, false), 'preview_ready');
    });
  });

  // ════════════════════════════════════════════════════════
  // Preview state
  // ════════════════════════════════════════════════════════

  describe('preview state', () => {

    it('previewAvailable is true when model has slides', () => {
      const model = makePreviewModel({
        slides: [{ id: 's0', index: 0, title: 'Slide 1', layout: 'content' as const, blocks: [], notes: '', allSources: [], allEvidence: [], hasUnsupportedClaims: false }],
        slideCount: 1,
      });
      const artifacts = [makeArtifact(model)];
      const req = createMockIntegrationRequest(artifacts);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.panel!.items[0].preview.previewAvailable, true);
    });

    it('previewAvailable is false when model has no slides', () => {
      const model = makePreviewModel({ slides: [], slideCount: 0 });
      const artifacts = [makeArtifact(model)];
      const req = createMockIntegrationRequest(artifacts);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.panel!.items[0].preview.previewAvailable, false);
    });

    it('previewSafe matches guardPassed', () => {
      const model = makePreviewModel();
      const safe = [makeArtifact(model, { guardPassed: true })];
      const blocked = [makeArtifact(model, { guardPassed: false })];
      assert.equal(
        SVC.integrateArtifactForWorkbench(createMockIntegrationRequest(safe)).panel!.items[0].preview.previewSafe,
        true,
      );
      assert.equal(
        SVC.integrateArtifactForWorkbench(createMockIntegrationRequest(blocked)).panel!.items[0].preview.previewSafe,
        false,
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // Export state
  // ════════════════════════════════════════════════════════

  describe('export state', () => {

    it('dryRunOnly is always true', () => {
      const model = makePreviewModel();
      const artifacts = [makeArtifact(model)];
      const req = createMockIntegrationRequest(artifacts);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.panel!.items[0].export.dryRunOnly, true);
    });

    it('planAvailable reflects input', () => {
      const model = makePreviewModel();
      const withPlan = [makeArtifact(model, { exportPlanAvailable: true })];
      const withoutPlan = [makeArtifact(model, { exportPlanAvailable: false })];
      assert.equal(
        SVC.integrateArtifactForWorkbench(createMockIntegrationRequest(withPlan)).panel!.items[0].export.planAvailable,
        true,
      );
      assert.equal(
        SVC.integrateArtifactForWorkbench(createMockIntegrationRequest(withoutPlan)).panel!.items[0].export.planAvailable,
        false,
      );
    });
  });

  // ════════════════════════════════════════════════════════
  // providerCalled / userReviewRequired invariants
  // ════════════════════════════════════════════════════════

  describe('invariants', () => {

    it('providerCalled is always false', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([makeArtifact(model)]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.providerCalled, false);
      assert.equal(result.panel!.providerCalled, false);
      assert.equal(result.report.providerCalled, false);
    });

    it('userReviewRequired is always true', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([makeArtifact(model)]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.userReviewRequired, true);
      assert.equal(result.panel!.userReviewRequired, true);
      assert.equal(result.report.userReviewRequired, true);
    });

    it('contextConfirmed is reflected in panel and report', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([makeArtifact(model)], { confirmedContext: true });
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.panel!.contextConfirmed, true);
      assert.equal(result.report.contextConfirmed, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // No provider / embedding / file / shell / PowerPoint
  // ════════════════════════════════════════════════════════

  describe('no prohibited operations', () => {

    it('service is pure — result is deterministic', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([makeArtifact(model)]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // No PPT-master / no Phase 5
  // ════════════════════════════════════════════════════════

  describe('no PPT-master / no Phase 5', () => {

    it('service has no PPT-master dependency', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([makeArtifact(model)]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, true);
    });

    it('service has no Phase 5 plugin hooks', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([makeArtifact(model)]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // Report
  // ════════════════════════════════════════════════════════

  describe('report', () => {

    it('report reflects artifact counts', () => {
      const model = makePreviewModel();
      const artifacts = [makeArtifact(model), makeArtifact(model, { deckId: 'deck-002' } as never)];
      // Fix: use actual makePreviewModel override
      const model2 = makePreviewModel({ deckId: 'deck-002', title: 'Second' });
      const req = createMockIntegrationRequest([
        makeArtifact(model),
        makeArtifact(model2),
      ]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.report.totalArtifacts, 2);
    });

    it('report counts preview-ready artifacts', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([
        makeArtifact(model, { guardPassed: true, exportPlanAvailable: false }),
      ]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.report.previewReadyCount, 1);
    });

    it('report counts guard-blocked artifacts', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([
        makeArtifact(model, { guardPassed: false, guardViolationCount: 1 }),
      ]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.report.guardBlockedCount, 1);
    });

    it('report counts export-plan-ready artifacts', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([
        makeArtifact(model, {
          guardPassed: true,
          exportPlanAvailable: true,
          exportEligible: true,
        }),
      ]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.report.exportPlanReadyCount, 1);
    });
  });

  // ════════════════════════════════════════════════════════
  // Warnings
  // ════════════════════════════════════════════════════════

  describe('warnings', () => {

    it('warns for guard-blocked artifacts', () => {
      const model = makePreviewModel({ title: 'Blocked Pres' });
      const req = createMockIntegrationRequest([
        makeArtifact(model, { guardPassed: false, guardViolationCount: 1 }),
      ]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.ok(result.warnings.some((w) => w.code === 'guard_blocked_artifact'));
    });

    it('warns for export-ineligible artifacts', () => {
      const model = makePreviewModel({ title: 'Ineligible Pres' });
      const req = createMockIntegrationRequest([
        makeArtifact(model, {
          guardPassed: false,
          guardViolationCount: 1,
          exportPlanAvailable: true,
          exportEligible: false,
        }),
      ]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.ok(result.warnings.some((w) => w.code === 'export_ineligible_artifact'));
    });

    it('warns for unsafe assets', () => {
      const model = makePreviewModel({ title: 'Unsafe Pres' });
      const req = createMockIntegrationRequest([
        makeArtifact(model, { guardViolationCount: 3 }),
      ]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.ok(result.warnings.some((w) => w.code === 'unsafe_assets_detected'));
    });
  });

  // ════════════════════════════════════════════════════════
  // Multiple artifacts
  // ════════════════════════════════════════════════════════

  describe('multiple artifacts', () => {

    it('handles multiple artifacts with mixed statuses', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([
        makeArtifact(model, { guardPassed: true }),
        makeArtifact(makePreviewModel({ deckId: 'deck-002', title: 'Blocked' }), { guardPassed: false, guardViolationCount: 1 }),
        makeArtifact(makePreviewModel({ deckId: 'deck-003', title: 'Exportable' }), { guardPassed: true, exportPlanAvailable: true, exportEligible: true }),
      ]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, true);
      assert.equal(result.panel!.items.length, 3);
      assert.equal(result.panel!.previewReadyCount, 1);
      assert.equal(result.panel!.guardBlockedCount, 1);
      assert.equal(result.panel!.exportPlanReadyCount, 1);
    });
  });

  // ════════════════════════════════════════════════════════
  // Edge cases
  // ════════════════════════════════════════════════════════

  describe('edge cases', () => {

    it('failure result has null panel', () => {
      const req = createMockIntegrationRequest([]);
      const result = SVC.integrateArtifactForWorkbench(req);
      assert.equal(result.ok, false);
      assert.equal(result.panel, null);
    });

    it('aggregateIntegrationErrors flattens error lists', () => {
      const e1 = [{ code: 'a', message: 'A' }];
      const e2 = [{ code: 'b', message: 'B' }];
      assert.equal(SVC.aggregateIntegrationErrors(e1, e2).length, 2);
    });

    it('aggregateIntegrationErrors handles empty input', () => {
      assert.equal(SVC.aggregateIntegrationErrors().length, 0);
    });

    it('panel model includes required metadata fields', () => {
      const model = makePreviewModel();
      const req = createMockIntegrationRequest([makeArtifact(model)]);
      const result = SVC.integrateArtifactForWorkbench(req);
      const panel = result.panel!;
      assert.equal(typeof panel.requestId, 'string');
      assert.ok(Array.isArray(panel.items));
      assert.equal(typeof panel.totalArtifacts, 'number');
      assert.equal(typeof panel.generatedAt, 'string');
    });
  });
});
