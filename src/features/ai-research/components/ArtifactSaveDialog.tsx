import { useMemo, useState, type ReactElement } from 'react';
import type { AIArtifactDraft } from '../../../lib/contracts/ai-research.types';

export interface ArtifactSaveDialogProps {
  readonly artifact: AIArtifactDraft;
  readonly saving: boolean;
  readonly onConfirm: (targetRelativePath: string, overwriteConfirmed: boolean) => void;
  readonly onClose: () => void;
}

function sanitizeFileStem(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized.length > 0 ? normalized : 'ai-artifact-draft';
}

export function ArtifactSaveDialog({
  artifact,
  saving,
  onConfirm,
  onClose,
}: ArtifactSaveDialogProps): ReactElement {
  const defaultPath = useMemo(() => {
    const date = new Date(artifact.createdAt).toISOString().slice(0, 10);
    return `_ai_drafts/${date}-${sanitizeFileStem(artifact.title)}.md`;
  }, [artifact.createdAt, artifact.title]);
  const [targetRelativePath, setTargetRelativePath] = useState(defaultPath);
  const [overwriteConfirmed, setOverwriteConfirmed] = useState(false);

  return (
    <div
      className="settings-dialog-overlay"
      data-testid="artifact-save-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="artifact-save-dialog-title"
    >
      <section className="settings-dialog">
        <div className="settings-dialog-header">
          <span className="settings-dialog-icon">↧</span>
          <h2 id="artifact-save-dialog-title" className="settings-dialog-title">
            保存草稿
          </h2>
        </div>
        <div className="settings-dialog-body">
          <p className="settings-dialog-lead">
            仅保存到 Vault 内的 Markdown 文件。不会写入隐藏目录、系统目录或 Vault 外路径。
          </p>
          <label className="workspace-ai-research-runtime-field">
            <span>Vault 相对路径</span>
            <input
              className="settings-input"
              value={targetRelativePath}
              onChange={(event) => setTargetRelativePath(event.target.value)}
              data-testid="artifact-save-relative-path"
            />
          </label>
          <label className="settings-dialog-radio">
            <input
              type="checkbox"
              checked={overwriteConfirmed}
              onChange={(event) => setOverwriteConfirmed(event.target.checked)}
            />
            <span>如果文件已存在，确认覆盖</span>
          </label>
        </div>
        <div className="settings-dialog-footer">
          <button
            type="button"
            className="settings-dialog-btn settings-dialog-btn-primary"
            disabled={saving || targetRelativePath.trim().length === 0}
            onClick={() => onConfirm(targetRelativePath, overwriteConfirmed)}
            data-testid="artifact-save-confirm-btn"
          >
            {saving ? '保存中...' : '确认保存'}
          </button>
          <button
            type="button"
            className="settings-dialog-btn settings-dialog-btn-secondary"
            disabled={saving}
            onClick={onClose}
            data-testid="artifact-save-cancel-btn"
          >
            取消
          </button>
        </div>
      </section>
    </div>
  );
}
