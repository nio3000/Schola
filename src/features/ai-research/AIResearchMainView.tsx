/**
 * AIResearchMainView — Phase 5-5-IMP-1-R3.
 *
 * Research workbench semantic layout:
 * - Left column: context and references only.
 * - Center column: response, runtime model/skill selector, task input.
 * - Right column: artifact draft only.
 *
 * Provider connection details stay in Settings / Model Supplier.
 */

import { useMemo, useRef, useState, type ReactElement } from 'react';
import { createAcceptedPrivacyConsentState } from '../../lib/contracts/settings.types';
import { confirmContextPack } from '../../lib/platform/ai-research-api';
import { openGeneratedMarkdown, revealGeneratedMarkdown } from '../../lib/platform/schola-api';
import { setAIPreferences, setPrivacyConsent } from '../../lib/platform/settings-api';
import { getAllSkills } from '../../lib/ai-skill-preset-registry';
import type { ProviderReadiness } from '../../lib/contracts/ai-research.types';
import type { FileEntry } from '../../lib/contracts/vault.types';
import { ArtifactDraftPreview } from './components/ArtifactDraftPreview';
import { ArtifactSaveDialog } from './components/ArtifactSaveDialog';
import { EvidenceList } from './components/EvidenceList';
import { ContextConfirmationModal } from './components/ContextConfirmationModal';
import { PrivacyConsentModal } from './components/PrivacyConsentModal';
import {
  useAIResearchWorkbench,
  type AIResearchWorkbenchStage,
} from './hooks/useAIResearchWorkbench';

export interface AIResearchMainViewProps {
  readonly vaultId: string | null;
  readonly fileTree: readonly FileEntry[];
  readonly selectedFile?: string | null;
}

function getProviderStatusLabel(provider: ProviderReadiness | null): string {
  if (!provider) return '未配置';
  if (provider.ready) return '已连接';
  if (provider.localFreeReady) return '本地可用';
  if (!provider.keyConfigured) return '缺少密钥';
  if (provider.enabled === false) return '不可用';
  return '不可用';
}

function formatModelValue(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`;
}

function parseModelValue(value: string): { readonly providerId: string; readonly modelId: string } {
  const [providerId, ...modelParts] = value.split('::');
  return { providerId, modelId: modelParts.join('::') };
}

function getTaskStatusLabel(stage: AIResearchWorkbenchStage): string {
  if (stage === 'streaming') return '生成中';
  if (stage === 'running' || stage === 'drafting' || stage === 'draft_created') return '准备中';
  if (stage === 'cancelled') return '已取消';
  if (stage === 'completed') return '已完成';
  if (stage === 'failed') return '失败';
  return '空闲';
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '未知';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getSourceTypeLabel(sourceType: string, displayName: string): string {
  const lower = displayName.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
  const labels: Record<string, string> = {
    '.md': 'MD',
    '.markdown': 'MD',
    '.pdf': 'PDF',
    '.doc': 'DOC',
    '.docx': 'DOCX',
    '.xls': 'XLS',
    '.xlsx': 'XLSX',
    '.csv': 'CSV',
    '.txt': 'TXT',
    '.html': 'HTML',
    '.htm': 'HTML',
    '.tex': 'TeX',
    '.bib': 'BIB',
    '.ris': 'RIS',
  };
  return labels[ext] ?? sourceType.toUpperCase();
}

export function AIResearchMainView({
  vaultId,
  fileTree,
  selectedFile,
}: AIResearchMainViewProps): ReactElement {
  const workbench = useAIResearchWorkbench({ vaultId, fileTree });
  const skills = useMemo(() => getAllSkills(), []);
  const [selectedSkillId, setSelectedSkillId] = useState(
    skills.find((skill) => skill.title === '论文精读')?.skillId ?? skills[0]?.skillId ?? '',
  );
  const modelSelectRef = useRef<HTMLSelectElement | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showPrivacyConsent, setShowPrivacyConsent] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');

  const selectedSkill = skills.find((skill) => skill.skillId === selectedSkillId) ?? skills[0];
  const selectedModelValue = workbench.selectedProvider
    ? formatModelValue(workbench.selectedProvider.providerId, workbench.model)
    : '';
  const currentSource = selectedFile
    ? workbench.availableSources.find((source) => source.relativePath === selectedFile)
    : null;

  const responseText =
    workbench.currentArtifact?.content ??
    (workbench.streamingResponse.length > 0
      ? workbench.streamingResponse
      : workbench.stage === 'running' || workbench.stage === 'streaming'
        ? 'AI 正在生成回复...'
        : workbench.stage === 'cancelled'
          ? '任务已取消。'
          : '尚未生成回复。请选择上下文，确认本次模型与 Skill 后输入任务。');
  const contextTokenEstimate =
    workbench.contextPackPreview?.tokenEstimate.totalTokens ??
    workbench.selectedSources.reduce(
      (total, source) => total + Math.max(120, Math.round((source.fileSize ?? 0) / 4)),
      0,
    );
  const taskStatus = getTaskStatusLabel(workbench.stage);
  const selectedPathSet = useMemo(
    () => new Set(workbench.selectedSources.map((source) => source.relativePath)),
    [workbench.selectedSources],
  );
  const filteredSources = useMemo(() => {
    const keyword = sourceSearch.trim().toLowerCase();
    if (!keyword) return workbench.availableSources;
    return workbench.availableSources.filter((source) => {
      const haystack = `${source.displayName} ${source.relativePath} ${source.sourceType}`;
      return haystack.toLowerCase().includes(keyword);
    });
  }, [sourceSearch, workbench.availableSources]);
  const selectedSourcePreview = workbench.selectedSources.slice(0, 5);
  const canBuildContext = workbench.selectedSources.length > 0 && !workbench.loading;

  const buildPackAndConfirm = () => {
    void workbench.buildPack().then((ok) => {
      if (ok) setShowConfirmation(true);
    });
  };

  return (
    <div className="workspace-ai-research-codex" data-testid="ai-research-main-view">
      <header className="workspace-ai-research-hero workspace-ai-research-clean-hero">
        <div className="workspace-ai-research-title-block">
          <h1>AI 研究工作台</h1>
          <p>选择多份 Vault 文件，与当前模型一起生成可审查的科研草稿。</p>
        </div>
        <div className="workspace-ai-research-hero-status">
          <span
            className={`workspace-ai-research-status ${
              workbench.selectedProvider?.ready
                ? 'workspace-ai-research-status-ready'
                : 'workspace-ai-research-status-blocked'
            }`}
          >
            {getProviderStatusLabel(workbench.selectedProvider)}
          </span>
          <span>{taskStatus}</span>
        </div>
      </header>

      <div
        className="workspace-ai-research-three-column workspace-ai-research-chat-layout"
        data-testid="ai-research-three-column"
      >
        <aside
          className="workspace-ai-research-column workspace-ai-research-context-column workspace-ai-research-source-rail"
          data-testid="ai-research-context-column"
        >
          <section className="workspace-ai-research-card workspace-ai-research-source-card">
            <div className="workspace-ai-research-card-header workspace-ai-research-compact-header">
              <div>
                <p className="workspace-ai-research-kicker">Sources</p>
                <h3 className="workspace-ai-research-card-title">上下文</h3>
              </div>
              <span className="workspace-ai-research-count-pill">
                {workbench.selectedSources.length} 个
              </span>
            </div>

            <div className="workspace-ai-research-button-row workspace-ai-research-source-actions">
              <button
                type="button"
                className="workspace-ai-research-secondary-button"
                disabled={!currentSource}
                onClick={() => currentSource && workbench.toggleSource(currentSource)}
              >
                {currentSource && selectedPathSet.has(currentSource.relativePath)
                  ? '移除当前文档'
                  : '选择当前文档'}
              </button>
              <button
                type="button"
                className="workspace-ai-research-secondary-button"
                onClick={() => setShowSourcePicker(true)}
                data-testid="ai-research-open-source-picker-btn"
              >
                添加多文件
              </button>
              <button
                type="button"
                className="workspace-ai-research-secondary-button"
                disabled={!canBuildContext}
                onClick={buildPackAndConfirm}
                data-testid="ai-research-build-pack-btn"
              >
                {workbench.loading ? '构建中...' : '确认上下文'}
              </button>
            </div>

            <div className="workspace-ai-research-selected-strip" data-testid="ai-research-selected-source-strip">
              {workbench.selectedSources.length === 0 ? (
                <p className="workspace-ai-research-empty">尚未选择上下文资源。</p>
              ) : (
                <>
                  {selectedSourcePreview.map((source) => (
                    <button
                      type="button"
                      key={source.relativePath}
                      className="workspace-ai-research-source-chip"
                      onClick={() => workbench.toggleSource(source)}
                      title="点击移除"
                    >
                      <span>{source.displayName}</span>
                      <strong>×</strong>
                    </button>
                  ))}
                  {workbench.selectedSources.length > selectedSourcePreview.length ? (
                    <button
                      type="button"
                      className="workspace-ai-research-source-chip"
                      onClick={() => setShowSourcePicker(true)}
                    >
                      +{workbench.selectedSources.length - selectedSourcePreview.length}
                    </button>
                  ) : null}
                </>
              )}
            </div>

          </section>

          <section className="workspace-ai-research-card" data-testid="ai-research-context-summary">
            <div className="workspace-ai-research-card-header workspace-ai-research-compact-header">
              <div>
                <p className="workspace-ai-research-kicker">Context Summary</p>
                <h3 className="workspace-ai-research-card-title">上下文摘要</h3>
              </div>
            </div>
            <div className="workspace-ai-research-meta-grid">
              <span>已选文件数</span>
              <strong>{workbench.selectedSources.length}</strong>
              <span>估算 Token</span>
              <strong>
                {workbench.contextPackPreview
                  ? workbench.contextPackPreview.tokenEstimate.totalTokens.toLocaleString('zh-CN')
                  : contextTokenEstimate.toLocaleString('zh-CN')}
              </strong>
              <span>当前状态</span>
              <strong>
                {workbench.loading
                  ? '构建中...'
                  : workbench.contextConfirmed
                    ? '已确认'
                    : workbench.contextPackPreview
                      ? '等待确认'
                      : workbench.selectedSources.length > 0
                        ? '等待构建'
                        : '等待选择资源'}
              </strong>
            </div>
          </section>

          <div data-testid="ai-research-reference-list">
            <EvidenceList evidence={workbench.currentArtifact?.evidence ?? []} />
          </div>
        </aside>

        <main
          className="workspace-ai-research-column workspace-ai-research-response-column workspace-ai-research-chat-column"
          data-testid="ai-research-response-column"
        >
          <section className="workspace-ai-research-chat-thread">
            <div className="workspace-ai-research-chat-message workspace-ai-research-chat-message-system">
              <span>AI 研究工作台</span>
              <p>已准备好基于你选择的 Vault 文件生成草稿。模型输出不会自动写入 Vault。</p>
            </div>
            <div className="workspace-ai-research-card workspace-ai-research-response-card">
              <div className="workspace-ai-research-card-header workspace-ai-research-compact-header">
                <div>
                  <p className="workspace-ai-research-kicker">Response</p>
                  <h3 className="workspace-ai-research-card-title">模型回复</h3>
                </div>
                <span
                  className={`workspace-ai-research-status ${
                    workbench.selectedProvider?.ready
                      ? 'workspace-ai-research-status-ready'
                      : 'workspace-ai-research-status-blocked'
                  }`}
                >
                  {getProviderStatusLabel(workbench.selectedProvider)}
                </span>
              </div>
              <div className="workspace-ai-research-response-preview">{responseText}</div>
            </div>
          </section>

          <section
            className="workspace-ai-research-composer"
            data-testid="ai-research-task-input"
          >
            <div
              className="workspace-ai-research-composer-input"
              data-testid="ai-research-instruction-editor"
            >
              <textarea
                className="workspace-ai-research-textarea workspace-ai-research-composer-textarea"
                value={workbench.instruction}
                onChange={(event) => workbench.setInstruction(event.target.value)}
                placeholder={
                  workbench.contextConfirmed
                    ? '输入研究问题、比较维度或草稿要求'
                    : '先选择并确认上下文，再输入要交给模型的任务'
                }
              />
            </div>
            <div className="workspace-ai-research-composer-toolbar">
              <button
                type="button"
                className="workspace-ai-research-icon-button workspace-ai-research-composer-plus"
                onClick={() => setShowSourcePicker(true)}
                aria-label="添加文件"
                title="添加文件"
              >
                +
              </button>
              <span className="workspace-ai-research-composer-context">
                {workbench.selectedSources.length > 0
                  ? `${workbench.selectedSources.length} 个文件`
                  : '未选择文件'}
              </span>
              <span
                className={`workspace-ai-research-status ${
                  workbench.contextConfirmed
                    ? 'workspace-ai-research-status-ready'
                    : 'workspace-ai-research-status-blocked'
                }`}
              >
                {workbench.contextConfirmed ? '上下文已确认' : '待确认上下文'}
              </span>
              <div className="workspace-ai-research-composer-spacer" />

              {!workbench.currentTask ||
              workbench.stage === 'pack_built' ||
              workbench.stage === 'cancelled' ||
              workbench.stage === 'failed' ? (
                <button
                  type="button"
                  className="workspace-ai-research-primary-button"
                  data-testid="ai-research-create-draft-btn"
                  disabled={
                    !workbench.contextConfirmed ||
                    workbench.loading ||
                    workbench.instruction.trim().length === 0
                  }
                  onClick={() => {
                    void workbench.createDraft(selectedSkill?.promptTemplate);
                  }}
                >
                  {workbench.loading && workbench.stage === 'drafting' ? '创建中...' : '生成草稿'}
                </button>
              ) : (
                <button
                  type="button"
                  className="workspace-ai-research-primary-button"
                  data-testid="ai-research-run-btn"
                  disabled={
                    workbench.loading ||
                    workbench.stage === 'running' ||
                    workbench.stage === 'streaming' ||
                    workbench.stage === 'completed'
                  }
                  onClick={() => {
                    if (!workbench.privacyConsented) {
                      setShowPrivacyConsent(true);
                      return;
                    }
                    void workbench.runTask();
                  }}
                >
                  {workbench.loading &&
                  (workbench.stage === 'running' || workbench.stage === 'streaming')
                    ? '生成中...'
                    : workbench.stage === 'completed'
                      ? '已完成'
                      : '生成'}
                </button>
              )}
              <button
                type="button"
                className="workspace-ai-research-icon-button"
                data-testid="ai-research-cancel-btn"
                disabled={workbench.stage !== 'running' && workbench.stage !== 'streaming'}
                onClick={() => {
                  void workbench.cancelCurrentTask();
                }}
                aria-label="取消"
                title="取消"
              >
                ■
              </button>
            </div>
            {workbench.currentTask && !workbench.privacyConsented ? (
              <p
                className="workspace-ai-research-runtime-note"
                data-testid="ai-research-privacy-gate-note"
              >
                生成前需要确认本次发送范围与隐私边界。
              </p>
            ) : null}
          </section>
        </main>

        <aside
          className="workspace-ai-research-column workspace-ai-research-artifact-column workspace-ai-research-inspector"
          data-testid="ai-research-artifact-column"
        >
          <section
            className="workspace-ai-research-card workspace-ai-research-runtime-card"
            data-testid="ai-research-runtime-controls"
          >
            <div className="workspace-ai-research-card-header workspace-ai-research-compact-header">
              <div>
                <p className="workspace-ai-research-kicker">Environment</p>
                <h3 className="workspace-ai-research-card-title">环境信息</h3>
              </div>
            </div>
            <div className="workspace-ai-research-runtime-stack">
              <label className="workspace-ai-research-runtime-field">
                <span>当前模型</span>
                <select
                  ref={modelSelectRef}
                  className="workspace-ai-research-select"
                  value={selectedModelValue}
                  data-testid="ai-research-runtime-model-select"
                  onChange={(event) => {
                    const next = parseModelValue(event.target.value);
                    workbench.changeProvider(next.providerId);
                    workbench.setSelectedModel(next.modelId);
                  }}
                >
                  {workbench.providerReadiness.length === 0 ? (
                    <option value="">未选择模型</option>
                  ) : null}
                  {workbench.providerReadiness.flatMap((provider) =>
                    provider.models.map((model) => (
                      <option
                        key={formatModelValue(provider.providerId, model.id)}
                        value={formatModelValue(provider.providerId, model.id)}
                      >
                        {provider.preset.displayName} / {model.displayName}
                      </option>
                    )),
                  )}
                </select>
              </label>
              <label className="workspace-ai-research-runtime-field">
                <span>Skill</span>
                <select
                  className="workspace-ai-research-select"
                  value={selectedSkillId}
                  onChange={(event) => setSelectedSkillId(event.target.value)}
                  data-testid="ai-research-skill-select"
                >
                  {skills.map((skill) => (
                    <option key={skill.skillId} value={skill.skillId}>
                      {skill.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="workspace-ai-research-meta-grid">
                <span>状态</span>
                <strong>{getProviderStatusLabel(workbench.selectedProvider)}</strong>
                <span>任务</span>
                <strong>{taskStatus}</strong>
                <span>自动保存</span>
                <strong>否</strong>
              </div>
            </div>
            <p className="workspace-ai-research-runtime-note">
              {selectedSkill?.description ?? '请选择本次研究任务使用的 Skill。'}
            </p>
            <button
              type="button"
              className="workspace-ai-research-secondary-button workspace-ai-research-model-focus"
              data-testid="ai-research-switch-model-button"
              onClick={() => modelSelectRef.current?.focus()}
            >
              切换模型
            </button>
          </section>

          <section className="workspace-ai-research-card" data-testid="ai-research-task-status">
            <div className="workspace-ai-research-card-header workspace-ai-research-compact-header">
              <div>
                <p className="workspace-ai-research-kicker">Task Status</p>
                <h3 className="workspace-ai-research-card-title">任务状态</h3>
              </div>
              <span
                className={`workspace-ai-research-status ${
                  taskStatus === '失败'
                    ? 'workspace-ai-research-status-blocked'
                    : 'workspace-ai-research-status-ready'
                }`}
              >
                {taskStatus}
              </span>
            </div>
            <div className="workspace-ai-research-meta-grid">
              <span>人工审查</span>
              <strong>需要</strong>
              <span>上下文</span>
              <strong>{workbench.contextConfirmed ? '已确认' : '未确认'}</strong>
            </div>
          </section>

          <ArtifactDraftPreview
            artifact={workbench.currentArtifact}
            saving={workbench.loading && showSaveDialog}
            savedRelativePath={
              workbench.currentArtifact?.savedRelativePath ?? workbench.savedArtifactPath
            }
            onSave={() => setShowSaveDialog(true)}
            onDiscard={() => {
              if (window.confirm('丢弃当前草稿？此操作不会写入 Vault。')) {
                void workbench.discardCurrentArtifact();
              }
            }}
            onOpenSaved={() => {
              const relativePath =
                workbench.currentArtifact?.savedRelativePath ?? workbench.savedArtifactPath;
              if (vaultId && relativePath) {
                void openGeneratedMarkdown(vaultId, relativePath);
              }
            }}
            onRevealSaved={() => {
              const relativePath =
                workbench.currentArtifact?.savedRelativePath ?? workbench.savedArtifactPath;
              if (vaultId && relativePath) {
                void revealGeneratedMarkdown(vaultId, relativePath);
              }
            }}
          />
        </aside>
      </div>

      {workbench.error && (
        <div className="workspace-ai-research-error" data-testid="ai-research-error">
          {workbench.error}
        </div>
      )}

      {showSourcePicker ? (
        <div
          className="workspace-ai-research-source-picker-overlay"
          data-testid="ai-research-source-picker"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-research-source-picker-title"
        >
          <div className="workspace-ai-research-source-picker">
            <div className="workspace-ai-research-source-picker-header">
              <div>
                <p className="workspace-ai-research-kicker">Vault Files</p>
                <h3 id="ai-research-source-picker-title" className="workspace-ai-research-card-title">
                  选择多个文件
                </h3>
              </div>
              <button
                type="button"
                className="workspace-ai-research-icon-button"
                aria-label="关闭文件选择"
                onClick={() => setShowSourcePicker(false)}
              >
                ×
              </button>
            </div>
            <input
              className="workspace-ai-research-source-search"
              value={sourceSearch}
              onChange={(event) => setSourceSearch(event.target.value)}
              placeholder="搜索文件名或路径"
              data-testid="ai-research-source-search"
            />
            <div className="workspace-ai-research-source-list workspace-ai-research-picker-list">
              {filteredSources.length === 0 ? (
                <p className="workspace-ai-research-empty">没有匹配的文件。</p>
              ) : (
                filteredSources.map((source) => {
                  const selected = selectedPathSet.has(source.relativePath);
                  return (
                    <label
                      key={source.relativePath}
                      className={`workspace-ai-research-source-row ${
                        selected ? 'workspace-ai-research-source-row-selected' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => workbench.toggleSource(source)}
                        data-testid={`ai-research-source-checkbox-${source.relativePath}`}
                      />
                      <span className="workspace-ai-research-source-main">
                        <span className="workspace-ai-research-source-name">
                          {source.displayName}
                        </span>
                        <span className="workspace-ai-research-source-path">
                          {source.relativePath}
                        </span>
                      </span>
                      <span className="workspace-ai-research-source-type">
                        {getSourceTypeLabel(source.sourceType, source.displayName)}
                      </span>
                      <span className="workspace-ai-research-source-size">
                        {formatFileSize(source.fileSize)}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <div className="workspace-ai-research-source-picker-footer">
              <button
                type="button"
                className="workspace-ai-research-secondary-button"
                disabled={workbench.selectedSources.length === 0}
                onClick={() => {
                  workbench.selectedSources.forEach((source) => workbench.toggleSource(source));
                }}
              >
                清空
              </button>
              <span className="workspace-ai-research-runtime-note">
                已选择 {workbench.selectedSources.length} 个
              </span>
              <button
                type="button"
                className="workspace-ai-research-primary-button"
                disabled={!canBuildContext}
                onClick={() => {
                  setShowSourcePicker(false);
                  buildPackAndConfirm();
                }}
              >
                使用 {workbench.selectedSources.length} 个文件
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showConfirmation && workbench.contextPackPreview && (
        <ContextConfirmationModal
          preview={workbench.contextPackPreview}
          onConfirm={async () => {
            if (!workbench.contextPackPreview) return;
            await confirmContextPack({ contextPackId: workbench.contextPackPreview.packId });
            workbench.setContextConfirmed(true);
            setShowConfirmation(false);
          }}
          onClose={() => setShowConfirmation(false)}
        />
      )}

      {showPrivacyConsent && (
        <PrivacyConsentModal
          onConfirm={async () => {
            await setPrivacyConsent(createAcceptedPrivacyConsentState(true));
            await setAIPreferences({
              aiEnabled: true,
              defaultProviderId: workbench.selectedProvider?.providerId ?? null,
              defaultModel: workbench.model,
            });
            workbench.setPrivacyConsented(true);
            setShowPrivacyConsent(false);
          }}
          onClose={() => setShowPrivacyConsent(false)}
        />
      )}

      {showSaveDialog && workbench.currentArtifact && (
        <ArtifactSaveDialog
          artifact={workbench.currentArtifact}
          saving={workbench.loading}
          onConfirm={(targetRelativePath, overwriteConfirmed) => {
            void workbench
              .saveCurrentArtifact(targetRelativePath, overwriteConfirmed)
              .then((result) => {
                if (result) setShowSaveDialog(false);
              });
          }}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}
