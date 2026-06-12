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
import { getAllSkills } from '../../lib/ai-skill-preset-registry';
import type { ProviderReadiness } from '../../lib/contracts/ai-research.types';
import type { FileEntry } from '../../lib/contracts/vault.types';
import { ArtifactDraftPreview } from './components/ArtifactDraftPreview';
import { EvidenceList } from './components/EvidenceList';
import { InstructionEditor } from './components/InstructionEditor';
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
  if (stage === 'running' || stage === 'drafting' || stage === 'draft_created') return '生成中';
  if (stage === 'completed') return '已完成';
  if (stage === 'failed') return '失败';
  return '空闲';
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

  const selectedSkill = skills.find((skill) => skill.skillId === selectedSkillId) ?? skills[0];
  const selectedModelValue = workbench.selectedProvider
    ? formatModelValue(workbench.selectedProvider.providerId, workbench.model)
    : '';
  const currentSource = selectedFile
    ? workbench.availableSources.find((source) => source.relativePath === selectedFile)
    : null;

  const responseText =
    workbench.currentArtifact?.content ??
    (workbench.stage === 'running'
      ? 'AI 正在生成回复...'
      : '尚未生成回复。请选择上下文，确认本次模型与 Skill 后输入任务。');
  const contextTokenEstimate =
    workbench.contextPackPreview?.tokenEstimate.totalTokens ??
    workbench.selectedSources.reduce(
      (total, source) => total + Math.max(120, Math.round((source.fileSize ?? 0) / 4)),
      0,
    );
  const taskStatus = getTaskStatusLabel(workbench.stage);

  return (
    <div className="workspace-ai-research-codex" data-testid="ai-research-main-view">
      <header className="workspace-ai-research-hero">
        <div>
          <h1>AI 研究工作台</h1>
          <p>围绕本次研究任务组织上下文、模型、Skill 与草稿产物。</p>
        </div>
      </header>

      <div className="workspace-ai-research-three-column" data-testid="ai-research-three-column">
        <aside
          className="workspace-ai-research-column workspace-ai-research-context-column"
          data-testid="ai-research-context-column"
        >
          <section className="workspace-ai-research-card">
            <div className="workspace-ai-research-card-header">
              <div>
                <p className="workspace-ai-research-kicker">Context</p>
                <h3 className="workspace-ai-research-card-title">上下文</h3>
              </div>
              <span className="workspace-ai-research-count-pill">
                {workbench.selectedSources.length} 个
              </span>
            </div>

            <div className="workspace-ai-research-button-row">
              <button
                type="button"
                className="workspace-ai-research-secondary-button"
                disabled={!currentSource}
                onClick={() => currentSource && workbench.toggleSource(currentSource)}
              >
                选择当前文档
              </button>
              <button type="button" className="workspace-ai-research-secondary-button" disabled>
                添加资源
              </button>
              <button type="button" className="workspace-ai-research-secondary-button" disabled>
                预览 ContextPack
              </button>
            </div>

            <div className="workspace-ai-research-source-list">
              {workbench.selectedSources.length === 0 ? (
                <p className="workspace-ai-research-empty">尚未选择上下文资源。</p>
              ) : (
                workbench.selectedSources.map((source) => (
                  <div key={source.relativePath} className="workspace-ai-research-source-row">
                    <span className="workspace-ai-research-source-main">
                      <span className="workspace-ai-research-source-name">
                        {source.displayName}
                      </span>
                      <span className="workspace-ai-research-source-path">
                        {source.relativePath}
                      </span>
                    </span>
                    <span className="workspace-ai-research-source-type">{source.sourceType}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="workspace-ai-research-card" data-testid="ai-research-context-summary">
            <div className="workspace-ai-research-card-header">
              <div>
                <p className="workspace-ai-research-kicker">Context Summary</p>
                <h3 className="workspace-ai-research-card-title">上下文摘要</h3>
              </div>
            </div>
            <div className="workspace-ai-research-meta-grid">
              <span>已选文件数</span>
              <strong>{workbench.selectedSources.length}</strong>
              <span>估算 Token</span>
              <strong>{contextTokenEstimate.toLocaleString('zh-CN')}</strong>
              <span>当前状态说明</span>
              <strong>{workbench.selectedSources.length > 0 ? '等待预览确认' : '等待选择资源'}</strong>
            </div>
          </section>

          <section className="workspace-ai-research-card" data-testid="ai-research-task-status">
            <div className="workspace-ai-research-card-header">
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
              <span>自动保存</span>
              <strong>否</strong>
            </div>
          </section>

          <div data-testid="ai-research-reference-list">
            <EvidenceList evidence={workbench.currentArtifact?.evidence ?? []} />
          </div>
        </aside>

        <main
          className="workspace-ai-research-column workspace-ai-research-response-column"
          data-testid="ai-research-response-column"
        >
          <section className="workspace-ai-research-card workspace-ai-research-response-card">
            <div className="workspace-ai-research-card-header">
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
          </section>

          <section
            className="workspace-ai-research-card workspace-ai-research-runtime-card"
            data-testid="ai-research-runtime-controls"
          >
            <div className="workspace-ai-research-runtime-row">
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

              <div className="workspace-ai-research-runtime-field">
                <span>状态</span>
                <strong>{getProviderStatusLabel(workbench.selectedProvider)}</strong>
              </div>

              <button
                type="button"
                className="workspace-ai-research-secondary-button"
                data-testid="ai-research-switch-model-button"
                onClick={() => modelSelectRef.current?.focus()}
              >
                切换模型
              </button>

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
            </div>
            <p className="workspace-ai-research-runtime-note">
              {selectedSkill?.description ?? '请选择本次研究任务使用的 Skill。'}
            </p>
          </section>

          <section className="workspace-ai-research-task-column" data-testid="ai-research-task-input">
            <InstructionEditor value={workbench.instruction} onChange={workbench.setInstruction} />
            <button
              type="button"
              className="workspace-ai-research-primary-button"
              data-testid="ai-research-run-btn"
              disabled
            >
              生成草稿
            </button>
          </section>
        </main>

        <aside
          className="workspace-ai-research-column workspace-ai-research-artifact-column"
          data-testid="ai-research-artifact-column"
        >
          <ArtifactDraftPreview artifact={workbench.currentArtifact} />
        </aside>
      </div>

      {workbench.error && (
        <div className="workspace-ai-research-error" data-testid="ai-research-error">
          {workbench.error}
        </div>
      )}
    </div>
  );
}
