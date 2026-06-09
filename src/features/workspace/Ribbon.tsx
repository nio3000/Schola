import type { ReactElement } from 'react';
import type { PreviewMode } from '../graph/lib/graphTypes';

export interface RibbonProps {
  readonly showSidebar: boolean;
  readonly previewMode: PreviewMode;
  // Phase 4-0-B-IMP-4: Runtime Settings hidden — deferred to Plugin Manager phase.
  // readonly showRuntimeSettings: boolean;
  readonly onToggleSidebar: () => void;
  readonly onTogglePreviewMode: () => void;
  // readonly onToggleRuntimeSettings: () => void;
}

export function Ribbon({ showSidebar, previewMode, onToggleSidebar, onTogglePreviewMode }: RibbonProps): ReactElement {
  const isGraphActive = previewMode === 'graph';

  return (
    <nav className="schola-ribbon" aria-label="Activity bar">
      <button
        type="button"
        className={`ribbon-btn${showSidebar ? ' ribbon-btn-active' : ''}`}
        data-testid="ribbon-vault"
        title="文件"
        aria-label="文件"
        aria-pressed={showSidebar}
        onClick={onToggleSidebar}
      >
        <span className="ribbon-icon">{'\uD83D\uDCC4'}</span>
      </button>
      <button
        type="button"
        className={`ribbon-btn ribbon-btn-graph${isGraphActive ? ' ribbon-btn-expanded' : ''}`}
        data-testid="ribbon-graph"
        title="图谱"
        aria-label="图谱"
        aria-pressed={isGraphActive}
        onClick={onTogglePreviewMode}
      >
        <span className="ribbon-icon">{'\uD83D\uDD17'}</span>
      </button>
      {/* Phase 4-0-B-IMP-4: Runtime Settings button hidden. */}
      {/* <button
        type="button"
        className={`ribbon-btn${showRuntimeSettings ? ' ribbon-btn-active' : ''}`}
        data-testid="ribbon-runtime"
        title="增强能力"
        aria-label="增强能力"
        aria-pressed={showRuntimeSettings}
        onClick={onToggleRuntimeSettings}
      >
        <span className="ribbon-icon">{'\u2699'}</span>
      </button> */}
    </nav>
  );
}