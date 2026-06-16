import type { ReactElement } from 'react';
import type { AIArtifactDraft } from '../../../lib/contracts/ai-research.types';

export interface ArtifactDraftPreviewProps {
  readonly artifact: AIArtifactDraft | null;
  readonly saving?: boolean;
  readonly savedRelativePath?: string | null;
  readonly onSave?: () => void;
  readonly onDiscard?: () => void;
  readonly onOpenSaved?: () => void;
  readonly onRevealSaved?: () => void;
}

export function ArtifactDraftPreview({
  artifact,
  saving = false,
  savedRelativePath = null,
  onSave,
  onDiscard,
  onOpenSaved,
  onRevealSaved,
}: ArtifactDraftPreviewProps): ReactElement {
  const evidence = artifact?.evidenceRefs ?? artifact?.evidence ?? [];

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

      <div className="workspace-ai-research-evidence-list" data-testid="artifact-evidence-ref-list">
        {evidence.length === 0 ? (
          <p className="workspace-ai-research-empty">暂无 EvidenceRef。</p>
        ) : (
          evidence.map((item) => (
            <div key={item.id} className="workspace-ai-research-evidence-item">
              <div className="workspace-ai-research-evidence-head">
                <span
                  className={`workspace-ai-research-evidence-badge ${
                    item.kind === 'source-backed'
                      ? 'workspace-ai-research-evidence-source'
                      : 'workspace-ai-research-evidence-inferred'
                  }`}
                >
                  {item.kind === 'source-backed' ? '来源证据' : '模型推断'}
                </span>
                <strong>{item.label}</strong>
              </div>
              <p>
                {item.kind === 'source-backed'
                  ? `${item.relativePath ?? item.sourceRef?.relativePath ?? 'metadata-only'} · ${
                      item.quotePreview ? item.quotePreview : 'metadata-only，未生成正文摘录'
                    }`
                  : item.modelInferredNote ?? item.note ?? '此项不是来源证据，需人工核验。'}
              </p>
            </div>
          ))
        )}
      </div>

      {savedRelativePath ? (
        <p className="workspace-ai-research-runtime-note" data-testid="artifact-saved-path">
          已保存：{savedRelativePath}
        </p>
      ) : null}

      <div className="workspace-ai-research-button-row">
        <button
          type="button"
          className="workspace-ai-research-secondary-button"
          disabled={!artifact || saving || artifact.status === 'discarded'}
          onClick={onSave}
          data-testid="artifact-save-btn"
        >
          {saving ? '保存中...' : artifact?.status === 'saved' ? '另存草稿' : '保存草稿'}
        </button>
        <button
          type="button"
          className="workspace-ai-research-secondary-button"
          disabled={!artifact || saving || artifact.status === 'discarded'}
          onClick={onDiscard}
          data-testid="artifact-discard-btn"
        >
          丢弃草稿
        </button>
        {savedRelativePath ? (
          <>
            <button
              type="button"
              className="workspace-ai-research-secondary-button"
              onClick={onOpenSaved}
              data-testid="artifact-open-saved-btn"
            >
              打开
            </button>
            <button
              type="button"
              className="workspace-ai-research-secondary-button"
              onClick={onRevealSaved}
              data-testid="artifact-reveal-saved-btn"
            >
              定位
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
