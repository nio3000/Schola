import type { ReactElement } from 'react';
import type { AIArtifactDraft } from '../../../lib/contracts/ai-research.types';

export interface ArtifactDraftPreviewProps {
  readonly artifact: AIArtifactDraft | null;
}

export function ArtifactDraftPreview({ artifact }: ArtifactDraftPreviewProps): ReactElement {
  return (
    <section className="workspace-ai-research-card workspace-ai-research-artifact-card" data-testid="ai-research-artifact-draft-preview">
      <div className="workspace-ai-research-review-banner">需要人工审查：当前内容仅为草稿，不会自动保存到 Vault。</div>
      <div className="workspace-ai-research-card-header">
        <div>
          <p className="workspace-ai-research-kicker">产物草稿</p>
          <h3 className="workspace-ai-research-card-title">{artifact?.title ?? '尚未生成草稿'}</h3>
        </div>
        <span className="workspace-ai-research-draft-pill">草稿</span>
      </div>

      <div className="workspace-ai-research-artifact-preview">
        {artifact ? artifact.content : '运行草稿任务后，这里会显示只读草稿预览。'}
      </div>

      <div className="workspace-ai-research-button-row">
        <button type="button" className="workspace-ai-research-secondary-button" disabled>
          保存到 Vault：Phase 5-3+
        </button>
        <button type="button" className="workspace-ai-research-secondary-button" disabled>
          导出：Phase 5-4
        </button>
      </div>
    </section>
  );
}
