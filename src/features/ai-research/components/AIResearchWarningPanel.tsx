import type { ReactElement } from 'react';
import type { AIResearchWarning } from '../../../lib/contracts/ai-research.types';

export interface AIResearchWarningPanelProps {
  readonly warnings: readonly AIResearchWarning[];
  readonly error: string | null;
}

export function AIResearchWarningPanel({ warnings, error }: AIResearchWarningPanelProps): ReactElement {
  return (
    <section className="workspace-ai-research-card" data-testid="ai-research-warning-panel">
      <div className="workspace-ai-research-card-header">
        <div>
          <p className="workspace-ai-research-kicker">风险提示</p>
          <h3 className="workspace-ai-research-card-title">截断与置信度</h3>
        </div>
        <span className="workspace-ai-research-count-pill">{warnings.length + (error ? 1 : 0)} 条</span>
      </div>

      {error ? <p className="workspace-ai-research-error">{error}</p> : null}
      {warnings.length === 0 && !error ? (
        <p className="workspace-ai-research-muted">暂无截断、低置信度或运行警告。</p>
      ) : (
        <ul className="workspace-ai-research-compact-list">
          {warnings.map((warning) => (
            <li key={`${warning.code}-${warning.message}`} data-severity={warning.severity}>
              {warning.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
