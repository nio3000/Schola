import type { ReactElement } from 'react';
import type { IndexStatus } from '../../../lib/contracts/index-status.types';

const STATUS_LABELS: Record<string, string> = {
  ready: '索引：正常',
  rebuilding: '索引：重建中',
  missing: '索引：缺失',
  error: '索引：错误',
  corrupted: '索引：已损坏',
};

export interface IndexStatusIndicatorProps {
  readonly status: IndexStatus | null;
  readonly isRebuilding: boolean;
  readonly rebuildError: string | null;
  readonly rebuildDisabled: boolean;
  readonly rebuildDisabledReason: string | null;
  readonly onRebuild: () => void;
}

export function IndexStatusIndicator({
  status,
  isRebuilding,
  rebuildError,
  rebuildDisabled,
  rebuildDisabledReason,
  onRebuild,
}: IndexStatusIndicatorProps): ReactElement | null {
  if (!status) return null;

  const state = status.state;
  const label = STATUS_LABELS[state] ?? `索引：${state}`;
  const fileInfo = status.fileCount > 0 ? ` · ${status.fileCount} 文件` : '';

  return (
    <span
      className="index-status-indicator"
      data-testid="index-status-indicator"
      data-index-status={state}
      data-index-rebuilding={isRebuilding ? 'true' : 'false'}
    >
      <span className="index-status-text" data-testid="index-status-text">
        {label}
        {fileInfo}
      </span>
      {(rebuildError) ? (
        <span className="index-status-error" data-testid="index-status-error" title={rebuildError}>
          {rebuildError}
        </span>
      ) : null}
      <button
        type="button"
        className="index-rebuild-button"
        data-testid="index-rebuild-button"
        disabled={rebuildDisabled}
        title={rebuildDisabledReason ?? undefined}
        onClick={onRebuild}
      >
        {isRebuilding ? '◉ 重建中...' : '🔄 重建索引'}
      </button>
    </span>
  );
}
