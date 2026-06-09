/**
 * BottomPanel — Phase 5-0.
 *
 * Collapsible bottom panel area for Artifact Panel and Runtime Diagnostics.
 * Defaults to collapsed; expands upward when toggled open.
 *
 * Key invariants:
 * - Read-only: displays placeholder content only, no runtime actions
 * - Collapsible: does not affect Editor/Preview height when collapsed
 * - No runtime: does not execute diagnostics, export, or provider calls
 */
import type { CSSProperties, ReactElement, RefCallback } from 'react';

export interface BottomPanelProps {
  readonly isOpen: boolean;
  readonly height?: number;
  readonly onToggle: () => void;
  readonly onResizeStart?: (event: React.PointerEvent) => void;
  readonly resizerRef?: RefCallback<HTMLElement>;
}

export function BottomPanel({
  isOpen,
  height,
  onToggle,
  onResizeStart,
  resizerRef,
}: BottomPanelProps): ReactElement {
  const panelStyle: CSSProperties | undefined = isOpen && height ? { height } : undefined;

  return (
    <div
      className={`schola-bottom-panel${isOpen ? ' schola-bottom-panel-open' : ''}`}
      data-testid="bottom-panel"
      style={panelStyle}
    >
      {isOpen && (
        <div
          ref={resizerRef}
          className="bottom-panel-resizer"
          data-testid="bottom-panel-resizer"
          role="separator"
          aria-label="调整底部面板高度"
          aria-orientation="horizontal"
          onPointerDown={onResizeStart}
        />
      )}
      <button
        type="button"
        className="bottom-panel-toggle"
        data-testid="bottom-panel-toggle"
        title={isOpen ? '收起面板' : '展开面板'}
        aria-label={isOpen ? '收起面板' : '展开面板'}
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span className="bottom-panel-toggle-icon">{isOpen ? '\u25BC' : '\u25B2'}</span>
        <span className="bottom-panel-toggle-label">运行时诊断</span>
      </button>
      {isOpen && (
        <div className="bottom-panel-content" data-testid="bottom-panel-content">
          <div className="bottom-panel-placeholder">
            <p className="bottom-panel-placeholder-title">运行时诊断 · 即将推出</p>
            <p className="bottom-panel-placeholder-desc">
              当前未接入运行时诊断。Provider 状态、索引状态、任务状态等将在后续阶段接入。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
