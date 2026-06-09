/**
 * Artifact Panel — Phase 4-5-IMP-1 + IMP-2 + IMP-3.
 *
 * Read-only UI component that displays artifact pipeline status.
 * IMP-2 adds ArtifactDetailDrawer for inspecting individual artifacts.
 * IMP-3 adds ContextConfirmation / ReviewRequired banners.
 *
 * Key invariants:
 * - Read-only: no export, no save, no provider config, no model selector
 * - No file I/O, no IPC, no shell access, no PPT-master, no Phase 5
 * - All data comes from already-frozen AIWorkbenchArtifactPanelModel
 */
import { useState, type ReactElement } from 'react';
import type {
  AIWorkbenchArtifactPanelModel,
  AIWorkbenchArtifactPanelItem,
  AIWorkbenchArtifactStatus,
} from '../../../lib/contracts/ppt-artifact.types';

// ── Status config ─────────────────────────────────────

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

// ── Props ──────────────────────────────────────────────

export interface ArtifactPanelProps {
  /** The panel model from AIWorkbenchArtifactIntegrationService (or null for empty state). */
  readonly panel: AIWorkbenchArtifactPanelModel | null;
}

// ── Components ─────────────────────────────────────────

/** Status badge for a single artifact status. */
function ArtifactStatusBadge({ status }: { readonly status: AIWorkbenchArtifactStatus }): ReactElement {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Invariant badges: providerCalled=false, userReviewRequired=true, contextConfirmed. */
function ArtifactInvariantBadges({ panel }: { readonly panel: AIWorkbenchArtifactPanelModel }): ReactElement {
  return (
    <div className="flex flex-wrap gap-1 mt-2 text-xs text-gray-500">
      <span className="px-1.5 py-0.5 bg-gray-100 rounded">未调用模型</span>
      <span className="px-1.5 py-0.5 bg-gray-100 rounded">需用户审查</span>
      {panel.contextConfirmed && (
        <span className="px-1.5 py-0.5 bg-gray-100 rounded">上下文已确认</span>
      )}
    </div>
  );
}

/** Warning display for guard-blocked artifacts. */
function GuardWarning({ item }: { readonly item: AIWorkbenchArtifactPanelItem }): ReactElement | null {
  if (item.status !== 'guard_blocked') return null;
  return (
    <div className="mt-1 text-xs text-red-600">
      资产引用未通过安全校验（{item.preview.guardViolationCount} 项违规）— 需修正后重新生成
    </div>
  );
}

/** Warning display for export-ineligible artifacts. */
function ExportIneligibleWarning({ item }: { readonly item: AIWorkbenchArtifactPanelItem }): ReactElement | null {
  if (item.status !== 'export_ineligible') return null;
  return (
    <div className="mt-1 text-xs text-yellow-700">
      暂不可进入导出计划（{item.export.unsafeAssetRefs} 项不安全资产）— 需通过资产安全校验
    </div>
  );
}

/** Dry-run export plan summary. */
function DryRunPlanSummary({ item }: { readonly item: AIWorkbenchArtifactPanelItem }): ReactElement | null {
  if (item.status !== 'export_plan_ready' && item.status !== 'export_ineligible') return null;
  return (
    <div className="mt-1 text-xs text-gray-500">
      <span className="font-medium">仅导出计划</span>
      {item.export.unsafeAssetRefs > 0 && (
        <span className="ml-1">— {item.export.unsafeAssetRefs} 项不安全资产</span>
      )}
    </div>
  );
}

/** Empty state when no artifacts are available. */
function ArtifactPanelEmpty(): ReactElement {
  return (
    <div className="p-4 text-center text-gray-400 text-sm" data-testid="artifact-panel-empty">
      暂无可预览的 Artifact
    </div>
  );
}

// ── Banners (IMP-3) ────────────────────────────────────

function ContextConfirmationBanner({ panel }: { readonly panel: AIWorkbenchArtifactPanelModel }): ReactElement {
  return (
    <div
      className={`px-3 py-2 text-xs ${panel.contextConfirmed ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}
      data-testid="context-confirmation-banner"
    >
      {panel.contextConfirmed ? '上下文已确认' : '上下文未确认 — 仅可预览，不可执行导出或保存'}
    </div>
  );
}

function ReviewRequiredBanner({ panel }: { readonly panel: AIWorkbenchArtifactPanelModel }): ReactElement | null {
  if (!panel.userReviewRequired) return null;
  return (
    <div className="px-3 py-2 text-xs bg-blue-50 text-blue-700" data-testid="review-required-banner">
      需用户审查 — 生成内容需人工确认后才能进入后续流程
    </div>
  );
}

function ProviderNotCalledBanner({ panel }: { readonly panel: AIWorkbenchArtifactPanelModel }): ReactElement | null {
  if (panel.providerCalled) return null;
  return (
    <div className="px-3 py-1.5 text-xs bg-gray-50 text-gray-500" data-testid="provider-not-called-banner">
      未调用模型
    </div>
  );
}

/** A single artifact item row. */
function ArtifactPanelItemRow({
  item,
  isSelected,
  onSelect,
}: {
  readonly item: AIWorkbenchArtifactPanelItem;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}): ReactElement {
  return (
    <div
      className={`p-3 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-400' : ''}`}
      data-testid="artifact-panel-item"
      onClick={onSelect}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-gray-800 truncate">{item.title}</span>
        <ArtifactStatusBadge status={item.status} />
      </div>
      <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5">
        <span>{item.slideCount} slides</span>
        <span>{item.totalSourceRefs} sources</span>
        <span>{item.totalEvidenceRefs} evidence</span>
        {item.totalAssetRefs > 0 && <span>{item.totalAssetRefs} assets</span>}
      </div>
      <GuardWarning item={item} />
      <ExportIneligibleWarning item={item} />
      <DryRunPlanSummary item={item} />
    </div>
  );
}

// ── Detail Drawer ──────────────────────────────────────

/** Artifact Detail Drawer — read-only inspection of a single artifact. */
function ArtifactDetailDrawer({
  item,
  onClose,
}: {
  readonly item: AIWorkbenchArtifactPanelItem;
  readonly onClose: () => void;
}): ReactElement {
  return (
    <div className="flex flex-col h-full" data-testid="artifact-detail-drawer">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 truncate">{item.title}</h3>
        <button
          className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
          onClick={onClose}
          data-testid="detail-drawer-close"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-sm">
        {/* Status */}
        <div>
          <span className="text-xs text-gray-400">状态</span>
          <div className="mt-1">
            <ArtifactStatusBadge status={item.status} />
          </div>
        </div>

        {/* Counts */}
        <div>
          <span className="text-xs text-gray-400">内容摘要</span>
          <div className="mt-1 grid grid-cols-2 gap-1 text-gray-700">
            <span>Slides: {item.slideCount}</span>
            <span>Sources: {item.totalSourceRefs}</span>
            <span>Evidence: {item.totalEvidenceRefs}</span>
            {item.totalAssetRefs > 0 && <span>Assets: {item.totalAssetRefs}</span>}
          </div>
        </div>

        {/* Invariants */}
        <div>
          <span className="text-xs text-gray-400">状态标记</span>
          <div className="mt-1 flex flex-wrap gap-1">
            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-500">未调用模型</span>
            <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-500">需用户审查</span>
          </div>
        </div>

        {/* Preview State */}
        <div>
          <span className="text-xs text-gray-400">预览状态</span>
          <div className="mt-1 grid grid-cols-2 gap-1 text-gray-700 text-xs">
            <span data-testid="detail-preview-available">
              可预览: {item.preview.previewAvailable ? '是' : '否'}
            </span>
            <span data-testid="detail-guard-passed">
              安全校验: {item.preview.guardPassed ? '通过' : '未通过'}
            </span>
            <span data-testid="detail-guard-violations">
              违规项: {item.preview.guardViolationCount}
            </span>
            <span data-testid="detail-preview-safe">
              预览安全: {item.preview.previewSafe ? '是' : '否'}
            </span>
          </div>
        </div>

        {/* Export State */}
        <div>
          <span className="text-xs text-gray-400">导出计划</span>
          <div className="mt-1 grid grid-cols-2 gap-1 text-gray-700 text-xs">
            <span data-testid="detail-plan-available">
              计划可用: {item.export.planAvailable ? '是' : '否'}
            </span>
            <span data-testid="detail-export-eligible">
              可执行: {item.export.exportEligible ? '是' : '否'}
            </span>
            <span data-testid="detail-unsafe-assets">
              不安全资产: {item.export.unsafeAssetRefs}
            </span>
            <span data-testid="detail-dry-run">
              仅导出计划: {item.export.dryRunOnly ? '是' : '否'}
            </span>
          </div>
        </div>

        {/* Warnings */}
        <GuardWarning item={item} />
        <ExportIneligibleWarning item={item} />

        {/* Dry-run note */}
        {(item.status === 'export_plan_ready' || item.status === 'export_ineligible') && (
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded" data-testid="detail-dry-run-note">
            此为 dry-run 导出计划，不做真实文件导出。
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────

/**
 * Artifact Panel — read-only display of artifact pipeline status.
 * IMP-2: supports selecting an artifact to view detail drawer.
 * No export, no save, no provider config, no model selector, no PPT-master.
 */
export function ArtifactPanel({ panel }: ArtifactPanelProps): ReactElement {
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);

  if (!panel || panel.items.length === 0) {
    return (
      <div className="artifact-panel" data-testid="artifact-panel">
        <ArtifactPanelEmpty />
      </div>
    );
  }

  const selectedItem = selectedDeckId
    ? panel.items.find((i) => i.deckId === selectedDeckId) ?? null
    : null;

  return (
    <div className="artifact-panel flex flex-col h-full" data-testid="artifact-panel">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">
          Artifacts ({panel.totalArtifacts})
        </h3>
        <div className="text-xs text-gray-400 mt-0.5">
          可预览 {panel.previewReadyCount} · 已阻止 {panel.guardBlockedCount} · 可导出计划 {panel.exportPlanReadyCount}
        </div>
        <ArtifactInvariantBadges panel={panel} />
      </div>

      {/* Banners (IMP-3) */}
      <ProviderNotCalledBanner panel={panel} />
      <ReviewRequiredBanner panel={panel} />
      <ContextConfirmationBanner panel={panel} />

      {/* Items */}
      <div className="flex-1 overflow-y-auto" data-testid="artifact-panel-list">
        {panel.items.map((item) => (
          <ArtifactPanelItemRow
            key={item.deckId}
            item={item}
            isSelected={selectedDeckId === item.deckId}
            onSelect={() =>
              setSelectedDeckId(selectedDeckId === item.deckId ? null : item.deckId)
            }
          />
        ))}
      </div>

      {/* Detail Drawer */}
      {selectedItem && (
        <div className="border-t border-gray-200 max-h-80 overflow-hidden">
          <ArtifactDetailDrawer
            item={selectedItem}
            onClose={() => setSelectedDeckId(null)}
          />
        </div>
      )}
    </div>
  );
}
