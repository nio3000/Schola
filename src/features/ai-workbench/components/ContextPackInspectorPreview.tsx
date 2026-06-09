/**
 * ContextPackInspectorPreview — Phase 4-8-UI-IMP.
 *
 * Read-only, fixture-driven preview of a ContextPackInspectorModel.
 * Displays selected sources, scope, coverage, and guard status —
 * no actions, no context send, no provider, no service, no IPC.
 *
 * Key invariants:
 * - Read-only: displays informational text only — no actions
 * - Fixture-driven: rendered from static ContextPackInspectorModel only
 * - No context send, no provider, no service, no IPC
 * - No Vault write, no file generation, no real source read
 * - Standalone component — not mounted to Route/Shell/ArtifactPanel
 */
import { type ReactElement } from 'react';
import type { ContextPackInspectorModel } from '../../../lib/contracts/contextpack-inspector.types';

// ── Props ──────────────────────────────────────────────

export interface ContextPackInspectorPreviewProps {
  readonly model: ContextPackInspectorModel;
  readonly className?: string;
}

// ── Main Component ─────────────────────────────────────

export function ContextPackInspectorPreview({
  model,
  className,
}: ContextPackInspectorPreviewProps): ReactElement {
  const hasSources = model.sources.length > 0;

  return (
    <div className={className} data-testid="contextpack-inspector-preview">
      {/* Guard status banner */}
      <div
        className="border-b border-gray-200 bg-gray-50 px-6 py-3"
        data-testid="inspector-guard-banner"
      >
        <p className="text-xs text-gray-500">当前为只读预览</p>
        <p className="text-xs text-gray-400 mt-0.5">
          未接入真实上下文发送 · 不调用模型 · 不写入 Vault
        </p>
      </div>

      {/* Source overview */}
      <div className="px-6 py-4" data-testid="inspector-source-overview">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">选定源</h3>
        {hasSources ? (
          <>
            <div className="flex flex-wrap gap-2 mb-2">
              <span
                className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700"
                data-testid="inspector-source-count"
              >
                {model.sourceCount} 个源
              </span>
              {model.sourceTypes.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600"
                  data-testid={`inspector-source-type-${t}`}
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-500" data-testid="inspector-scope">
              范围：{model.scope.displayName}
            </p>
          </>
        ) : (
          <p className="text-xs text-gray-400" data-testid="inspector-empty-state">
            暂无选定源
          </p>
        )}
      </div>

      {/* Evidence coverage */}
      <div className="px-6 py-4 border-t border-gray-100" data-testid="inspector-coverage">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">证据覆盖</h3>
        <div className="flex gap-3 text-xs text-gray-500">
          <span data-testid="inspector-coverage-sources">
            源文件：{model.coverage.sourceCount}
          </span>
          <span data-testid="inspector-coverage-evidence">
            证据引用：{model.coverage.evidenceRefCount}
          </span>
        </div>
        {model.coverage.unsupportedEvidenceWarning && (
          <p className="text-xs text-yellow-600 mt-1" data-testid="inspector-unsupported-warning">
            存在无依据声明
          </p>
        )}
      </div>

      {/* Guard flags */}
      <div
        className="px-6 py-3 border-t border-gray-100 bg-white"
        data-testid="inspector-guard-flags"
      >
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-gray-400" data-testid="inspector-flag-selected">
            selectedOnly
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400" data-testid="inspector-flag-readonly">
            readonly
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400" data-testid="inspector-flag-nocontext">
            noContextSend
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400" data-testid="inspector-flag-disabled">
            runtimeDisabled
          </span>
        </div>
      </div>
    </div>
  );
}
