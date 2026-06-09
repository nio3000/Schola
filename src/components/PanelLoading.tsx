/**
 * Lightweight loading fallback for lazy-loaded panels.
 * Used as the Suspense fallback for React.lazy components.
 * Does NOT trigger IPC calls, index rebuilds, or heavy work.
 */
import type { ReactElement } from 'react';

interface PanelLoadingProps {
  readonly label: string;
}

export function PanelLoading({ label }: PanelLoadingProps): ReactElement {
  return (
    <div className="panel-loading">
      <div className="panel-loading-spinner" />
      <span className="panel-loading-label">{label}</span>
    </div>
  );
}
