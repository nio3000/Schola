/**
 * AIResearchMainView — Phase 5-UX-REBASE-IMP-R6-R2 (Codex-like redesign).
 *
 * Simplified single-page project-style AI research interface.
 * Replaces the old three-column engineering console with a clean
 * prompt-first layout.
 *
 * Phase 5-2 business logic preserved. UI restructured for UX-REBASE.
 */

import { useState, type ReactElement } from 'react';
import type { FileEntry } from '../../lib/contracts/vault.types';
import { ArtifactDraftPreview } from './components/ArtifactDraftPreview';
import { ContextConfirmationModal } from './components/ContextConfirmationModal';
import { ContextSourceSelector } from './components/ContextSourceSelector';
import { EvidenceList } from './components/EvidenceList';
import { InstructionEditor } from './components/InstructionEditor';
import { PrivacyConsentModal } from './components/PrivacyConsentModal';
import { ProviderReadinessCard } from './components/ProviderReadinessCard';
import { useAIResearchWorkbench } from './hooks/useAIResearchWorkbench';

export interface AIResearchMainViewProps {
  readonly vaultId: string | null;
  readonly fileTree: readonly FileEntry[];
  readonly selectedFile?: string | null;
}

export function AIResearchMainView({ vaultId, fileTree }: AIResearchMainViewProps): ReactElement {
  const workbench = useAIResearchWorkbench({ vaultId, fileTree });
  const [contextModalOpen, setContextModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const hasContext = workbench.selectedSources.length > 0;
  const canRun = Boolean(workbench.contextPackPreview && workbench.instruction.trim().length > 0);

  return (
    <div className="workspace-ai-research-codex" data-testid="ai-research-main-view">
      {/* ── Header ── */}
      <header className="workspace-ai-research-hero">
        <div>
          <h1>AI 研究工作台</h1>
          <p>从知识库源文件中选择上下文，输入研究任务，生成需要人工审查的研究草稿。</p>
        </div>
      </header>

      {/* ── Provider / Model Bar ── */}
      <div className="workspace-ai-research-model-bar">
        <ProviderReadinessCard
          provider={workbench.selectedProvider}
          providers={workbench.providerReadiness}
          model={workbench.model}
          onProviderChange={workbench.setSelectedProviderId}
          onModelChange={workbench.setSelectedModel}
          onOpenDetails={() => {}}
        />
      </div>

      {/* ── Project Sources ── */}
      <section className="workspace-ai-research-sources-section">
        <h3 className="workspace-ai-research-section-title">Project Sources</h3>
        <ContextSourceSelector
          sources={workbench.availableSources}
          selectedSources={workbench.selectedSources}
          vaultReady={Boolean(vaultId)}
          loading={workbench.loading}
          onToggleSource={workbench.toggleSource}
          onBuildPack={workbench.buildPack}
        />
      </section>

      {/* ── Main Prompt Area ── */}
      <section className="workspace-ai-research-prompt-section">
        <h3 className="workspace-ai-research-section-title">研究任务</h3>
        <InstructionEditor value={workbench.instruction} onChange={workbench.setInstruction} />
      </section>

      {/* ── Context Summary + Run ── */}
      <div className="workspace-ai-research-actions">
        {hasContext && workbench.contextPackPreview && (
          <p className="workspace-ai-research-context-summary">
            已选择 {workbench.selectedSources.length} 个文件 · 预计 {workbench.contextPackPreview.tokenEstimate.totalTokens} Token
          </p>
        )}
        <button
          type="button"
          className="workspace-ai-research-run-btn"
          data-testid="ai-research-run-btn"
          disabled={!canRun}
          onClick={() => setContextModalOpen(true)}
        >
          确认上下文并运行
        </button>
        {workbench.currentTask && workbench.stage === 'running' && (
          <button
            type="button"
            className="workspace-ai-research-cancel-btn"
            onClick={workbench.cancelCurrentTask}
          >
            取消运行
          </button>
        )}
      </div>

      {/* ── Artifact Preview / Evidence ── */}
      <section className="workspace-ai-research-results-section">
        <h3 className="workspace-ai-research-section-title">草稿与证据</h3>
        {workbench.currentArtifact ? (
          <>
            <ArtifactDraftPreview artifact={workbench.currentArtifact} />
            <EvidenceList evidence={workbench.currentArtifact.evidence ?? []} />
          </>
        ) : (
          <div className="workspace-ai-research-empty-results" data-testid="ai-research-empty-results">
            <p>尚未运行任务。</p>
            <p>添加知识库源文件，输入研究问题后点击运行。</p>
          </div>
        )}
      </section>

      {/* ── Error / Warning ── */}
      {workbench.error && (
        <div className="workspace-ai-research-error" data-testid="ai-research-error">
          {workbench.error}
        </div>
      )}

      {/* ── Modals ── */}
      {contextModalOpen && (
        <ContextConfirmationModal
          preview={workbench.contextPackPreview}
          onClose={() => setContextModalOpen(false)}
          onConfirm={() => {
            workbench.setContextConfirmed(true);
            setContextModalOpen(false);
          }}
        />
      )}
      {privacyModalOpen && (
        <PrivacyConsentModal
          onClose={() => setPrivacyModalOpen(false)}
          onConfirm={() => {
            workbench.setPrivacyConsented(true);
            setPrivacyModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
