import type { ReactElement } from 'react';
import type { ResearchContextPreview } from '../../../lib/contracts/ai-research.types';

export interface ContextPackPreviewProps {
  readonly preview: ResearchContextPreview | null;
  readonly onOpenDetails: () => void;
}

export function ContextPackPreview({ preview, onOpenDetails }: ContextPackPreviewProps): ReactElement {
  return (
    <section className="workspace-ai-research-card" data-testid="ai-research-context-pack-preview">
      <div className="workspace-ai-research-card-header">
        <div>
          <p className="workspace-ai-research-kicker">上下文包草稿</p>
          <h3 className="workspace-ai-research-card-title">发送前摘要</h3>
        </div>
        <span className="workspace-ai-research-draft-pill">草稿</span>
      </div>

      {preview ? (
        <>
          <div className="workspace-ai-research-metric-row">
            <span>文件</span>
            <strong>{preview.fileCount}</strong>
            <span>预计 Token</span>
            <strong>{preview.tokenEstimate.totalTokens} / {preview.tokenEstimate.budget}</strong>
          </div>
          <div className="workspace-ai-research-metric-row">
            <span>截断文件</span>
            <strong>{preview.truncatedFileCount}</strong>
            <span>预算状态</span>
            <strong>{preview.tokenEstimate.exceedsBudget ? '超出' : '正常'}</strong>
          </div>
          {preview.warnings.length > 0 ? (
            <ul className="workspace-ai-research-compact-list">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className="workspace-ai-research-muted">暂无上下文警告。</p>
          )}
          <button type="button" className="workspace-ai-research-link-button" onClick={onOpenDetails}>
            查看上下文包详情
          </button>
        </>
      ) : (
        <p className="workspace-ai-research-empty">选择文件后构建上下文包草稿。</p>
      )}
    </section>
  );
}
