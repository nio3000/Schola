/**
 * PluginEcosystemStatusPreview — Phase 5-IMP-4.
 *
 * Read-only, fixture-driven preview of the official enhanced plugin ecosystem.
 * Displays plugin statuses, capability groups, permission gate decisions —
 * no actions, no enable/install/authorize, no marketplace, no runtime.
 *
 * Key invariants:
 * - Read-only: displays informational text only — no actions
 * - Fixture-driven: rendered from static PluginStatusFixture[] only
 * - No plugin runtime, no loader, no marketplace, no permission persistence
 * - No provider, no context send, no Vault write, no IPC
 * - Standalone component — not mounted to Route/Shell/ArtifactPanel
 */
import { type ReactElement } from 'react';
import type { PluginStatusFixture } from '../../../lib/contracts/plugin-ecosystem.types';

// ── Props ──────────────────────────────────────────────

export interface PluginEcosystemStatusPreviewProps {
  readonly statuses: readonly PluginStatusFixture[];
  readonly className?: string;
}

// ── Helpers ────────────────────────────────────────────

function decisionLabel(decision: string): string {
  switch (decision) {
    case 'allowed': return '已允许';
    case 'requires-user-confirmation': return '需用户确认';
    case 'requires-security-review': return '需安全审查';
    case 'blocked': return '已阻止';
    default: return decision;
  }
}

function decisionColor(decision: string): string {
  switch (decision) {
    case 'allowed': return 'bg-green-50 text-green-700';
    case 'requires-user-confirmation': return 'bg-yellow-50 text-yellow-700';
    case 'requires-security-review': return 'bg-orange-50 text-orange-700';
    case 'blocked': return 'bg-red-50 text-red-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

// ── Main Component ─────────────────────────────────────

export function PluginEcosystemStatusPreview({
  statuses,
  className,
}: PluginEcosystemStatusPreviewProps): ReactElement {
  return (
    <div className={className} data-testid="plugin-ecosystem-status-preview">
      {/* Guard banner */}
      <div
        className="border-b border-gray-200 bg-gray-50 px-6 py-3"
        data-testid="plugin-guard-banner"
      >
        <p className="text-xs text-gray-500">插件生态状态预览 — 只读</p>
        <p className="text-xs text-gray-400 mt-0.5">
          未接入插件运行时 · 未接入插件市场 · 未接入真实权限授权 · 不会写入 Vault · 不会调用模型
        </p>
      </div>

      {/* Plugin list */}
      <div className="divide-y divide-gray-100" data-testid="plugin-list">
        {statuses.map((st) => (
          <div key={st.manifest.id} className="px-6 py-4" data-testid={`plugin-${st.manifest.id}`}>
            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-800" data-testid="plugin-name">
                {st.manifest.name}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${decisionColor(st.permissionCheck.decision)}`} data-testid="plugin-decision">
                {decisionLabel(st.permissionCheck.decision)}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded" data-testid="plugin-state">
                {st.lifecycleState}
              </span>
            </div>

            <p className="text-xs text-gray-500 mb-2" data-testid="plugin-desc">
              {st.manifest.description}
            </p>

            {/* Capability groups */}
            <div className="flex flex-wrap gap-1 text-xs mb-1" data-testid="plugin-capabilities">
              {st.permissionSummary.alwaysGrantedCapabilities.map((c) => (
                <span key={c} className="px-1.5 py-0.5 rounded bg-green-50 text-green-600">
                  {c}
                </span>
              ))}
              {st.permissionSummary.userConfirmCapabilities.map((c) => (
                <span key={c} className="px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-600">
                  {c}
                </span>
              ))}
              {st.permissionSummary.securityReviewCapabilities.map((c) => (
                <span key={c} className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600">
                  {c}
                </span>
              ))}
            </div>

            {/* Guard flags */}
            <div className="flex gap-1.5 text-xs text-gray-400">
              <span data-testid="plugin-disabled">defaultEnabled=false</span>
              <span className="text-gray-300">·</span>
              <span data-testid="plugin-runtime">runtimeDisabled=true</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
