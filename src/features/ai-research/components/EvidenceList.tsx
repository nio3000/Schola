import type { ReactElement } from 'react';
import type { EvidenceRef } from '../../../lib/contracts/ai-research.types';

export interface EvidenceListProps {
  readonly evidence: readonly EvidenceRef[];
}

function extractionBadge(sourceType: string | undefined, label: string): string | null {
  if (sourceType !== 'pdf') return null;
  if (label.includes('已提取正文')) return 'PDF：已提取正文';
  if (label.includes('提取失败')) return 'PDF：提取失败';
  if (label.includes('metadata-only')) return 'PDF：metadata-only';
  return null;
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
            const pdfBadge = extractionBadge(item.sourceType, item.label);
            return (
              <li key={item.id} className="workspace-ai-research-evidence-item">
                <div className="workspace-ai-research-evidence-head">
                  <span className={`workspace-ai-research-evidence-badge ${sourceBacked ? 'workspace-ai-research-evidence-source' : 'workspace-ai-research-evidence-inferred'}`}>
                    {sourceBacked ? '来源证据' : '模型推断'}
                  </span>
                  {pdfBadge && (
                    <span className="workspace-ai-research-evidence-badge workspace-ai-research-evidence-source" data-testid="ai-research-pdf-extraction-badge">
                      {pdfBadge}
                    </span>
                  )}
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
