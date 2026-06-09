import type { ReactElement } from 'react';
import type { InvocationPreflightResult } from '../../../lib/contracts/ai-research.types';
import type { AIResearchWorkbenchStage } from '../hooks/useAIResearchWorkbench';

export interface RunGuardPanelProps {
  readonly preflight: InvocationPreflightResult;
  readonly stage: AIResearchWorkbenchStage;
  readonly loading: boolean;
  readonly hasTaskDraft: boolean;
  readonly canCreateDraft: boolean;
  readonly onCreateDraft: () => void;
  readonly onRun: () => void;
  readonly onOpenContextConfirmation: () => void;
  readonly onOpenPrivacyConsent: () => void;
}

export function RunGuardPanel({
  preflight,
  stage,
  loading,
  hasTaskDraft,
  canCreateDraft,
  onCreateDraft,
  onRun,
  onOpenContextConfirmation,
  onOpenPrivacyConsent,
}: RunGuardPanelProps): ReactElement {
  const runDisabled = !preflight.passed || !hasTaskDraft || loading || stage === 'running';

  return (
    <section className="workspace-ai-research-card" data-testid="ai-research-run-guard-panel">
      <div className="workspace-ai-research-card-header">
        <div>
          <p className="workspace-ai-research-kicker">运行守卫</p>
          <h3 className="workspace-ai-research-card-title">发送前检查</h3>
        </div>
        <span className={`workspace-ai-research-status ${preflight.passed ? 'workspace-ai-research-status-ready' : 'workspace-ai-research-status-blocked'}`}>
          {preflight.passed ? '✓ 可运行' : '✗ 已阻止'}
        </span>
      </div>

      <div className="workspace-ai-research-check-list">
        <span data-ready={preflight.providerReady ? 'true' : 'false'}>{preflight.providerReady ? '✓' : '✗'} 提供者就绪</span>
        <span data-ready={preflight.contextConfirmed ? 'true' : 'false'}>{preflight.contextConfirmed ? '✓' : '✗'} 上下文已确认</span>
        <span data-ready={preflight.privacyConsented ? 'true' : 'false'}>{preflight.privacyConsented ? '✓' : '✗'} 隐私同意已完成</span>
      </div>

      {preflight.blockedMessage ? (
        <p className="workspace-ai-research-blocked">阻止原因：{preflight.blockedMessage}</p>
      ) : null}

      <div className="workspace-ai-research-button-row">
        <button type="button" className="workspace-ai-research-secondary-button" onClick={onOpenContextConfirmation} disabled={!preflight.providerReady || loading}>
          确认上下文
        </button>
        <button type="button" className="workspace-ai-research-secondary-button" onClick={onOpenPrivacyConsent} disabled={loading}>
          隐私同意
        </button>
      </div>

      <div className="workspace-ai-research-button-row">
        <button type="button" className="workspace-ai-research-secondary-button" onClick={onCreateDraft} disabled={!canCreateDraft || loading}>
          创建任务草稿
        </button>
        <button type="button" className="workspace-ai-research-primary-button" onClick={onRun} disabled={runDisabled}>
          运行草稿
        </button>
      </div>
    </section>
  );
}
