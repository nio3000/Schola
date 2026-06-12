import type { ReactElement } from 'react';
import type { ProviderReadiness } from '../../../lib/contracts/ai-research.types';

export interface ProviderReadinessCardProps {
  readonly provider: ProviderReadiness | null;
  readonly providers: readonly ProviderReadiness[];
  readonly onProviderChange: (providerId: string) => void;
  readonly onOpenDetails: () => void;
}

export function ProviderReadinessCard({
  provider,
  providers,
  onProviderChange,
  onOpenDetails,
}: ProviderReadinessCardProps): ReactElement {
  const ready = provider?.ready ?? false;

  return (
    <section
      className="workspace-ai-research-card"
      data-testid="ai-research-provider-readiness-card"
    >
      <div className="workspace-ai-research-card-header">
        <div>
          <p className="workspace-ai-research-kicker">提供者就绪度</p>
          <h3 className="workspace-ai-research-card-title">
            {provider?.preset.displayName ?? '未配置提供者'}
          </h3>
        </div>
        <span
          className={`workspace-ai-research-status ${ready ? 'workspace-ai-research-status-ready' : 'workspace-ai-research-status-blocked'}`}
        >
          {ready ? '✓ 就绪' : '✗ 受阻'}
        </span>
      </div>

      <label className="workspace-ai-research-field">
        <span className="workspace-ai-research-label">提供者</span>
        <select
          className="workspace-ai-research-select"
          value={provider?.providerId ?? ''}
          onChange={(event) => onProviderChange(event.target.value)}
        >
          {providers.length === 0 ? <option value="">暂无提供者</option> : null}
          {providers.map((item) => (
            <option key={item.providerId} value={item.providerId}>
              {item.preset.displayName}
            </option>
          ))}
        </select>
      </label>

      <div className="workspace-ai-research-meta-grid">
        <span>密钥状态</span>
        <strong>{provider?.keyConfigured ? '✓ 已配置' : '✗ 未配置'}</strong>
        <span>本地可用</span>
        <strong>{provider?.localFreeReady ? '✓ 可用' : '✗ 不可用'}</strong>
      </div>

      {provider?.blockedReason ? (
        <p className="workspace-ai-research-blocked">{provider.blockedReason}</p>
      ) : null}

      <button type="button" className="workspace-ai-research-link-button" onClick={onOpenDetails}>
        查看提供者详情
      </button>
    </section>
  );
}
