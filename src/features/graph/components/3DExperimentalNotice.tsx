/**
 * 3DExperimentalNotice — Phase 5-UI-GRAPH-THEME-IMP-9.
 *
 * Disabled UI for 3D graph experimental candidate feature.
 * Shows that 3D graph is a future consideration, NOT currently available.
 */
import type { ReactElement } from 'react';

export interface Experimental3DNoticeProps {
  readonly isOpen: boolean;
}

export function Experimental3DNotice({ isOpen }: Experimental3DNoticeProps): ReactElement | null {
  if (!isOpen) return null;

  return (
    <aside
      className="graph-3d-experimental-notice"
      data-testid="graph-3d-experimental-notice"
      aria-label="3D Graph experimental candidate notice"
    >
      <div className="graph-3d-experimental-header">
        <span className="graph-3d-experimental-badge">实验候选</span>
        <h4 className="graph-3d-experimental-title">3D Graph</h4>
      </div>
      <p className="graph-3d-experimental-description">
        3D 知识图谱为实验候选功能，将在后续阶段单独评估。
        当前不提供真实 3D 运行时 (WebGL / Three.js)。
      </p>
      <label className="graph-3d-experimental-toggle">
        <input
          type="checkbox"
          checked={false}
          disabled
          aria-disabled="true"
          data-testid="graph-3d-experimental-toggle"
        />
        <span>启用 3D 视图（不可用）</span>
      </label>
      <p className="graph-3d-experimental-note">
        3D Graph is an experimental candidate feature to be evaluated in a future phase.
        No real 3D runtime (WebGL / Three.js) is currently available.
      </p>
    </aside>
  );
}
