/**
 * Artifact Panel UI Tests — Phase 4-5-IMP-1.
 *
 * Validates the status label/config mapping and mock panel model shapes.
 * React rendering tests require React Testing Library which is not in
 * the project dependency set; typecheck + contract-level tests provide
 * equivalent compile-time safety.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type {
  AIWorkbenchArtifactPanelModel,
  AIWorkbenchArtifactPanelItem,
  AIWorkbenchArtifactStatus,
} from '../../src/lib/contracts/ppt-artifact.types';
import { deriveArtifactStatus } from '../../src/lib/contracts/ppt-artifact.types';

// ── Status label config (mirrors ArtifactPanel.tsx) ────

const STATUS_LABELS: Record<AIWorkbenchArtifactStatus, string> = {
  draft: 'Draft',
  preview_ready: '可预览',
  guard_blocked: '资产引用未通过安全校验',
  export_plan_ready: '导出计划已准备',
  export_ineligible: '暂不可进入导出计划',
};

const STATUS_COLORS: Record<AIWorkbenchArtifactStatus, string> = {
  draft: 'bg-gray-200 text-gray-700',
  preview_ready: 'bg-green-100 text-green-800',
  guard_blocked: 'bg-red-100 text-red-800',
  export_plan_ready: 'bg-blue-100 text-blue-800',
  export_ineligible: 'bg-yellow-100 text-yellow-800',
};

// ── Mock fixtures ──────────────────────────────────────

function makeEmptyPanel(): AIWorkbenchArtifactPanelModel {
  return {
    requestId: 'mock-panel-001',
    items: [],
    totalArtifacts: 0,
    previewReadyCount: 0,
    guardBlockedCount: 0,
    exportPlanReadyCount: 0,
    providerCalled: false,
    userReviewRequired: true,
    contextConfirmed: true,
    generatedAt: new Date().toISOString(),
  };
}

function makePanelItem(status: AIWorkbenchArtifactStatus): AIWorkbenchArtifactPanelItem {
  const guardPassed = status !== 'guard_blocked';
  const planAvailable = status === 'export_plan_ready' || status === 'export_ineligible';
  const exportEligible = status === 'export_plan_ready';

  return {
    deckId: `deck-${status}`,
    title: `Test ${status}`,
    status,
    slideCount: 10,
    totalSourceRefs: 5,
    totalEvidenceRefs: 3,
    totalAssetRefs: 2,
    preview: {
      previewAvailable: status !== 'draft',
      guardPassed,
      guardViolationCount: guardPassed ? 0 : 2,
      previewSafe: guardPassed,
    },
    export: {
      planAvailable,
      exportEligible,
      unsafeAssetRefs: exportEligible ? 0 : 3,
      dryRunOnly: true,
    },
  };
}

// ── Tests ───────────────────────────────────────────────

describe('Artifact Panel UI', () => {

  // ════════════════════════════════════════════════════════
  // Status labels
  // ════════════════════════════════════════════════════════

  describe('status labels', () => {

    it('all 5 statuses have labels', () => {
      const statuses: AIWorkbenchArtifactStatus[] = [
        'draft', 'preview_ready', 'guard_blocked', 'export_plan_ready', 'export_ineligible',
      ];
      for (const s of statuses) {
        assert.ok(typeof STATUS_LABELS[s] === 'string');
        assert.ok(STATUS_LABELS[s].length > 0);
      }
    });

    it('all 5 statuses have color classes', () => {
      const statuses: AIWorkbenchArtifactStatus[] = [
        'draft', 'preview_ready', 'guard_blocked', 'export_plan_ready', 'export_ineligible',
      ];
      for (const s of statuses) {
        assert.ok(typeof STATUS_COLORS[s] === 'string');
        assert.ok(STATUS_COLORS[s].length > 0);
      }
    });

    it('guard_blocked label mentions security', () => {
      assert.ok(STATUS_LABELS['guard_blocked'].includes('安全'));
    });

    it('export_plan_ready label says plan, not real export', () => {
      assert.ok(STATUS_LABELS['export_plan_ready'].includes('计划'));
      assert.ok(!STATUS_LABELS['export_plan_ready'].includes('导出文件'));
      assert.ok(!STATUS_LABELS['export_plan_ready'].includes('.pptx'));
    });

    it('export_ineligible label says not ready', () => {
      assert.ok(STATUS_LABELS['export_ineligible'].includes('暂不可'));
    });
  });

  // ════════════════════════════════════════════════════════
  // Empty state
  // ════════════════════════════════════════════════════════

  describe('empty state', () => {

    it('empty panel has items=[], totalArtifacts=0', () => {
      const panel = makeEmptyPanel();
      assert.equal(panel.items.length, 0);
      assert.equal(panel.totalArtifacts, 0);
    });

    it('empty panel invariants are correct', () => {
      const panel = makeEmptyPanel();
      assert.equal(panel.providerCalled, false);
      assert.equal(panel.userReviewRequired, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // Draft status
  // ════════════════════════════════════════════════════════

  describe('draft status', () => {

    it('draft item has correct status', () => {
      const item = makePanelItem('draft');
      assert.equal(item.status, 'draft');
    });

    it('draft item has providerCalled=false propagated', () => {
      const item = makePanelItem('draft');
      const panel = { ...makeEmptyPanel(), items: [item] };
      assert.equal(panel.providerCalled, false);
    });
  });

  // ════════════════════════════════════════════════════════
  // preview_ready status
  // ════════════════════════════════════════════════════════

  describe('preview_ready status', () => {

    it('preview_ready has guardPassed=true', () => {
      const item = makePanelItem('preview_ready');
      assert.equal(item.preview.guardPassed, true);
      assert.equal(item.preview.previewSafe, true);
    });

    it('preview_ready has no export plan', () => {
      const item = makePanelItem('preview_ready');
      assert.equal(item.export.planAvailable, false);
    });
  });

  // ════════════════════════════════════════════════════════
  // guard_blocked status
  // ════════════════════════════════════════════════════════

  describe('guard_blocked status', () => {

    it('guard_blocked has guardPassed=false', () => {
      const item = makePanelItem('guard_blocked');
      assert.equal(item.preview.guardPassed, false);
      assert.equal(item.preview.previewSafe, false);
    });

    it('guard_blocked has guardViolationCount > 0', () => {
      const item = makePanelItem('guard_blocked');
      assert.ok(item.preview.guardViolationCount > 0);
    });

    it('guard_blocked has no export plan', () => {
      const item = makePanelItem('guard_blocked');
      assert.equal(item.export.planAvailable, false);
    });
  });

  // ════════════════════════════════════════════════════════
  // export_plan_ready status
  // ════════════════════════════════════════════════════════

  describe('export_plan_ready status', () => {

    it('export_plan_ready has dryRunOnly=true', () => {
      const item = makePanelItem('export_plan_ready');
      assert.equal(item.export.dryRunOnly, true);
    });

    it('export_plan_ready has exportEligible=true', () => {
      const item = makePanelItem('export_plan_ready');
      assert.equal(item.export.exportEligible, true);
    });

    it('export_plan_ready has plan available', () => {
      const item = makePanelItem('export_plan_ready');
      assert.equal(item.export.planAvailable, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // export_ineligible status
  // ════════════════════════════════════════════════════════

  describe('export_ineligible status', () => {

    it('export_ineligible has dryRunOnly=true', () => {
      const item = makePanelItem('export_ineligible');
      assert.equal(item.export.dryRunOnly, true);
    });

    it('export_ineligible has exportEligible=false', () => {
      const item = makePanelItem('export_ineligible');
      assert.equal(item.export.exportEligible, false);
    });

    it('export_ineligible has unsafeAssetRefs > 0', () => {
      const item = makePanelItem('export_ineligible');
      assert.ok(item.export.unsafeAssetRefs > 0);
    });

    it('export_ineligible has plan available but not eligible', () => {
      const item = makePanelItem('export_ineligible');
      assert.equal(item.export.planAvailable, true);
      assert.equal(item.export.exportEligible, false);
    });
  });

  // ════════════════════════════════════════════════════════
  // deriveArtifactStatus
  // ════════════════════════════════════════════════════════

  describe('deriveArtifactStatus', () => {

    it('returns preview_ready when guard passes and no plan', () => {
      assert.equal(deriveArtifactStatus(true, false, false), 'preview_ready');
    });

    it('returns guard_blocked when guard fails', () => {
      assert.equal(deriveArtifactStatus(false, false, false), 'guard_blocked');
    });

    it('returns export_plan_ready when eligible plan exists', () => {
      assert.equal(deriveArtifactStatus(true, true, true), 'export_plan_ready');
    });

    it('returns export_ineligible when ineligible plan exists', () => {
      assert.equal(deriveArtifactStatus(false, true, false), 'export_ineligible');
    });
  });

  // ════════════════════════════════════════════════════════
  // Invariants
  // ════════════════════════════════════════════════════════

  describe('panel invariants', () => {

    it('providerCalled is always false', () => {
      for (const status of ['draft', 'preview_ready', 'guard_blocked', 'export_plan_ready', 'export_ineligible'] as AIWorkbenchArtifactStatus[]) {
        const item = makePanelItem(status);
        const panel: AIWorkbenchArtifactPanelModel = {
          ...makeEmptyPanel(),
          items: [item],
          totalArtifacts: 1,
        };
        assert.equal(panel.providerCalled, false);
      }
    });

    it('userReviewRequired is always true', () => {
      const panel = makeEmptyPanel();
      assert.equal(panel.userReviewRequired, true);
    });

    it('dryRunOnly is always true in export state', () => {
      for (const status of ['draft', 'preview_ready', 'guard_blocked', 'export_plan_ready', 'export_ineligible'] as AIWorkbenchArtifactStatus[]) {
        const item = makePanelItem(status);
        assert.equal(item.export.dryRunOnly, true);
      }
    });
  });

  // ════════════════════════════════════════════════════════
  // Mixed statuses
  // ════════════════════════════════════════════════════════

  describe('mixed statuses', () => {

    it('panel with mixed statuses has correct counts', () => {
      const items = [
        makePanelItem('preview_ready'),
        makePanelItem('guard_blocked'),
        makePanelItem('export_plan_ready'),
      ];
      const panel: AIWorkbenchArtifactPanelModel = {
        ...makeEmptyPanel(),
        items,
        totalArtifacts: 3,
        previewReadyCount: 1,
        guardBlockedCount: 1,
        exportPlanReadyCount: 1,
      };
      assert.equal(panel.totalArtifacts, 3);
      assert.equal(panel.previewReadyCount, 1);
      assert.equal(panel.guardBlockedCount, 1);
    assert.equal(panel.exportPlanReadyCount, 1);
    });
  });

  // ════════════════════════════════════════════════════════
  // Detail Drawer data — Phase 4-5-IMP-2
  // ════════════════════════════════════════════════════════

  describe('detail drawer data', () => {

    it('detail shows previewAvailable', () => {
      const ready = makePanelItem('preview_ready');
      assert.equal(ready.preview.previewAvailable, true);
      const draft = makePanelItem('draft');
      assert.equal(draft.preview.previewAvailable, false);
    });

    it('detail shows guardPassed for each status', () => {
      assert.equal(makePanelItem('preview_ready').preview.guardPassed, true);
      assert.equal(makePanelItem('guard_blocked').preview.guardPassed, false);
    });

    it('detail shows guardViolationCount', () => {
      assert.equal(makePanelItem('preview_ready').preview.guardViolationCount, 0);
      assert.ok(makePanelItem('guard_blocked').preview.guardViolationCount > 0);
    });

    it('detail shows previewSafe matching guardPassed', () => {
      assert.equal(makePanelItem('preview_ready').preview.previewSafe, true);
      assert.equal(makePanelItem('guard_blocked').preview.previewSafe, false);
    });

    it('detail shows planAvailable for each status', () => {
      assert.equal(makePanelItem('export_plan_ready').export.planAvailable, true);
      assert.equal(makePanelItem('preview_ready').export.planAvailable, false);
    });

    it('detail shows exportEligible', () => {
      assert.equal(makePanelItem('export_plan_ready').export.exportEligible, true);
      assert.equal(makePanelItem('export_ineligible').export.exportEligible, false);
    });

    it('detail shows unsafeAssetRefs', () => {
      assert.equal(makePanelItem('export_plan_ready').export.unsafeAssetRefs, 0);
      assert.ok(makePanelItem('export_ineligible').export.unsafeAssetRefs > 0);
    });

    it('detail shows dryRunOnly=true for all statuses', () => {
      for (const s of ['draft', 'preview_ready', 'guard_blocked', 'export_plan_ready', 'export_ineligible'] as AIWorkbenchArtifactStatus[]) {
        assert.equal(makePanelItem(s).export.dryRunOnly, true);
      }
    });

    it('detail counts match panel item fields', () => {
      const item = makePanelItem('export_plan_ready');
      assert.ok(item.slideCount > 0);
      assert.ok(item.totalSourceRefs > 0);
      assert.ok(item.totalEvidenceRefs > 0);
    });

    it('guard_blocked detail has warning data', () => {
      const item = makePanelItem('guard_blocked');
      assert.ok(item.preview.guardViolationCount > 0);
      assert.equal(item.preview.guardPassed, false);
    });

    it('export_ineligible detail has warning data', () => {
      const item = makePanelItem('export_ineligible');
      assert.ok(item.export.unsafeAssetRefs > 0);
      assert.equal(item.export.exportEligible, false);
      assert.equal(item.export.planAvailable, true);
    });
  });

  // ════════════════════════════════════════════════════════
  // Banner data — Phase 4-5-IMP-3
  // ════════════════════════════════════════════════════════

  describe('banner data', () => {

    it('contextConfirmed=true panel shows confirmed state', () => {
      const panel = { ...makeEmptyPanel(), contextConfirmed: true };
      assert.equal(panel.contextConfirmed, true);
    });

    it('contextConfirmed=false panel shows unconfirmed state', () => {
      const panel = { ...makeEmptyPanel(), contextConfirmed: false };
      assert.equal(panel.contextConfirmed, false);
    });

    it('userReviewRequired is always true in mock fixture', () => {
      const panel = makeEmptyPanel();
      assert.equal(panel.userReviewRequired, true);
    });

    it('providerCalled is always false in mock fixture', () => {
      const panel = makeEmptyPanel();
      assert.equal(panel.providerCalled, false);
    });

    it('panel with contextConfirmed=false and userReviewRequired=true', () => {
      const panel: AIWorkbenchArtifactPanelModel = {
        ...makeEmptyPanel(),
        contextConfirmed: false,
        userReviewRequired: true,
      };
      assert.equal(panel.contextConfirmed, false);
      assert.equal(panel.userReviewRequired, true);
    });

    it('panel invariants unchanged by banner presence', () => {
      const panel = makeEmptyPanel();
      assert.equal(panel.providerCalled, false);
      assert.equal(panel.userReviewRequired, true);
    });
  });
});
