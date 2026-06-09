/**
 * CitationSurfacePreview — Phase 4-8-UI-IMP.
 *
 * Read-only, fixture-driven preview of a CitationSurfaceModel.
 * Displays citation placeholders, layer badges, and guard status —
 * no automatic citation generation, no external database, no web search.
 *
 * Key invariants:
 * - Read-only: displays citation placeholders only — no generation
 * - Fixture-driven: rendered from static CitationSurfaceModel only
 * - No auto citation, no reference building, no body modification
 * - No external database, no web search, no provider, no service, no IPC
 * - Standalone component — not mounted to Route/Shell/ArtifactPanel
 */
import { type ReactElement } from 'react';
import type { CitationSurfaceModel } from '../../../lib/contracts/contextpack-inspector.types';

// ── Props ──────────────────────────────────────────────

export interface CitationSurfacePreviewProps {
  readonly model: CitationSurfaceModel;
  readonly className?: string;
}

// ── Main Component ─────────────────────────────────────

export function CitationSurfacePreview({
  model,
  className,
}: CitationSurfacePreviewProps): ReactElement {
  return (
    <div className={className} data-testid="citation-surface-preview">
      {/* Guard status banner */}
      <div
        className="border-b border-gray-200 bg-gray-50 px-6 py-3"
        data-testid="citation-guard-banner"
      >
        <p className="text-xs text-gray-500">引用占位只读展示</p>
        <p className="text-xs text-gray-400 mt-0.5">
          不自动生成引用 · 不补全文献列表 · 不修改正文 · 不查询外部数据库 · 不执行网页搜索
        </p>
      </div>

      {/* Layer badges */}
      <div className="px-6 py-4 border-b border-gray-100" data-testid="citation-layers">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">证据层</h3>
        <div className="flex flex-wrap gap-2">
          <span
            className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700"
            data-testid="layer-evidence"
          >
            PDF 原文层 (evidence)
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700"
            data-testid="layer-index"
          >
            文本索引层 (index)
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700"
            data-testid="layer-compiled"
          >
            编译笔记层 (compiled)
          </span>
        </div>
      </div>

      {/* Citation placeholders */}
      <div className="px-6 py-4" data-testid="citation-placeholders">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">引用占位</h3>
        <div className="space-y-1 text-xs text-gray-500">
          <p data-testid="placeholder-page">
            页码引用：{model.pageRefs.length} 处
          </p>
          <p data-testid="placeholder-region">
            区域引用：{model.regionRefs.length} 处
          </p>
          <p data-testid="placeholder-figure">
            图表引用：{model.figureRefs.length} 处
          </p>
          <p data-testid="placeholder-table">
            表格引用：{model.tableRefs.length} 处
          </p>
          <p data-testid="placeholder-formula">
            公式引用：{model.formulaRefs.length} 处
          </p>
          <p data-testid="placeholder-screenshot">
            公式截图引用：{model.formulaScreenshotRefs.length} 处
          </p>
        </div>
      </div>

      {/* Guard flags */}
      <div
        className="px-6 py-3 border-t border-gray-100 bg-white"
        data-testid="citation-guard-flags"
      >
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="text-gray-400" data-testid="flag-placeholders">
            citationPlaceholdersOnly
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400" data-testid="flag-noautocite">
            noAutoCitation
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400" data-testid="flag-noextdb">
            noExternalDB
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400" data-testid="flag-noweb">
            noWebSearch
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-400" data-testid="flag-disabled">
            runtimeDisabled
          </span>
        </div>
      </div>
    </div>
  );
}
