import type { ReactElement, ReactNode } from 'react';
import type { ActivityId } from './ActivityBar';

const ACTIVITY_LABELS: Record<ActivityId, string> = {
  files: '\u6587\u4EF6',
  graph: '\u56FE\u8C31',
  ai: 'AI \u7814\u7A76\u5DE5\u4F5C\u53F0',
  artifacts: '\u4EA7\u7269',
  plugins: '\u63D2\u4EF6\u751F\u6001',
  settings: '\u8BBE\u7F6E',
};

export interface StatusBarProps {
  readonly filePath: string | null;
  readonly vaultName?: string | null;
  readonly activeActivity?: ActivityId;
  readonly children?: ReactNode;
}

export function StatusBar({
  filePath,
  vaultName,
  activeActivity,
  children,
}: StatusBarProps): ReactElement {
  return (
    <footer className="schola-statusbar" data-testid="statusbar">
      <div className="statusbar-left">
        {vaultName ? (
          <span className="statusbar-vault" data-testid="statusbar-vault">
            {vaultName}
          </span>
        ) : null}
        {filePath ? (
          <span className="statusbar-file" data-testid="statusbar-file">
            {filePath}
          </span>
        ) : null}
      </div>
      <div className="statusbar-center">
        {activeActivity ? (
          <span className="statusbar-activity" data-testid="statusbar-activity">
            模式: {ACTIVITY_LABELS[activeActivity]}
          </span>
        ) : null}
      </div>
      <div className="statusbar-right">
        {children}
        <span className="statusbar-index-placeholder">索引: 就绪</span>
      </div>
    </footer>
  );
}
