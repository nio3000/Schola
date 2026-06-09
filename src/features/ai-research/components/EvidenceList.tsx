import type { ReactElement } from 'react';
import type { EvidenceRef } from '../../../lib/contracts/ai-research.types';

export interface EvidenceListProps {
  readonly evidence: readonly EvidenceRef[];
}

export function EvidenceList({ evidence }: EvidenceListProps): ReactElement {
  return (
    <section className="workspace-ai-research-card" data-testid="ai-research-evidence-list">
      <div className="workspace-ai-research-card-header">
        <div>
          <p className="workspace-ai-research-kicker">证据边界</p>
          <h3 className="workspace-ai-research-card-title">引用与推断</h3>
        </div>
        <span className="workspace-ai-research-count-pill">{evidence.length} 条</span>
      </div>

      {evidence.length === 0 ? (
        <p className="workspace-ai-research-empty">暂无证据引用。模型推断不会被标记为来源证据。</p>
      ) : (
        <ul className="workspace-ai-research-evidence-list">
          {evidence.map((item) => {
            const sourceBacked = item.kind === 'source-backed';
            return (
              <li key={item.id} className="workspace-ai-research-evidence-item">
                <div className="workspace-ai-research-evidence-head">
                  <span className={`workspace-ai-research-evidence-badge ${sourceBacked ? 'workspace-ai-research-evidence-source' : 'workspace-ai-research-evidence-inferred'}`}>
                    {sourceBacked ? '来源证据' : '模型推断'}
                  </span>
                  <strong>{item.label}</strong>
                </div>
                {sourceBacked && item.sourceRef ? (
                  <p>{item.sourceRef.displayName} · {item.sourceRef.markdownHeading ?? item.sourceRef.pdfRegion ?? '定位待审查'}</p>
                ) : (
                  <p>{item.modelInferredNote ?? '此项不是来源证据，需人工核验。'}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
