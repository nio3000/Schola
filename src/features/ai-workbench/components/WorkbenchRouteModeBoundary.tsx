/**
 * WorkbenchRouteModeBoundary — Phase 4-7-IMP-3.
 *
 * Static, read-only boundary display for the Provider-Free Workbench
 * Route/Mode empty state and return boundary.
 *
 * Key invariants:
 * - Read-only: displays informational text only — no actions
 * - Provider-free: no provider config, no model selector, no API key
 * - No-action: no callbacks, no handlers, no event listeners
 * - Zero side effects: no service calls, no IPC, no file/Vault access
 * - No Workspace mutation: does not change current file/Vault/editor state
 * - Return boundary is informational only — real navigation wiring deferred as R3
 * - Preserves all Phase 4-5 / 4-6 / 4-7-IMP-1 / 4-7-IMP-2 frozen semantics
 */
import { type ReactElement } from 'react';

// ── Props ──────────────────────────────────────────────

export interface WorkbenchRouteModeBoundaryProps {
  /** Optional class for the outer container. */
  readonly className?: string;
}

// ── Status message constants ───────────────────────────

const ROUTE_MODE_MESSAGES = [
  '当前未接入真实导航状态',
  '当前不读取 Vault 文件',
  '当前不改变 Workspace 状态',
  '当前不改变编辑器内容',
  '当前不改变预览状态',
  '当前不改变图谱状态',
  '当前不触发 autosave',
  '当前不触发 reindex',
  '当前不触发 import / export',
  '当前不发送上下文',
  '当前不执行生成任务',
] as const;

const RETURN_BOUNDARY_MESSAGES = [
  '返回 Workspace：后续导航接入后启用',
  '当前不会改变编辑器、预览、图谱或文件状态',
  '真实 navigation wiring 后移为 R3',
] as const;

// ── Main Component ─────────────────────────────────────

/**
 * Route / Mode empty-state and return-boundary display.
 *
 * Provides read-only informational text about the current route/mode
 * boundaries and return Workspace capability status.
 * No actions, no callbacks, no side effects — purely static display.
 */
export function WorkbenchRouteModeBoundary({
  className,
}: WorkbenchRouteModeBoundaryProps): ReactElement {
  return (
    <div
      className={className}
      data-testid="workbench-route-mode-boundary"
    >
      {/* ── Route / Mode empty-state notice ── */}
      <div
        className="border-b border-gray-200 bg-white px-6 py-4"
        data-testid="route-mode-empty-state"
      >
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Route / Mode 空态边界
        </h2>
        <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
          {ROUTE_MODE_MESSAGES.map((msg) => (
            <li key={msg}>{msg}</li>
          ))}
        </ul>
      </div>

      {/* ── Return boundary notice ── */}
      <div
        className="border-b border-gray-200 bg-gray-50 px-6 py-4"
        data-testid="return-boundary"
      >
        <h2 className="text-sm font-semibold text-gray-600 mb-2">
          返回边界说明
        </h2>
        <div className="text-xs text-gray-400 space-y-1">
          {RETURN_BOUNDARY_MESSAGES.map((msg) => (
            <p key={msg}>{msg}</p>
          ))}
        </div>
      </div>

      {/* ── Context safety notice ── */}
      <div
        className="border-b border-blue-100 bg-blue-50 px-6 py-3"
        data-testid="boundary-safety-notice"
      >
        <p className="text-xs text-blue-600">
          当前阶段不接入真实 AI 能力：不读文件、不写 Vault、不调用
          provider、不发送上下文、不执行任务。返回能力后续导航接入阶段启用。
        </p>
      </div>
    </div>
  );
}
