/**
 * ProviderSettingsList — Phase 5-UX-REBASE-IMP-CONTINUE.
 *
 * OpenCode-like provider list for Settings Modal.
 * Shows connected providers first, then popular providers.
 *
 * Security: no API key display, no localStorage, no network fetch.
 */

import { type ReactElement, type ReactNode } from 'react';
import type { ProviderPreset } from '../../../lib/contracts/provider-preset.types';
import type { MaskedSecretStatus } from '../../../lib/contracts/settings.types';
import { PROVIDER_PRESETS } from '../../../lib/contracts/provider-preset.types';

export interface ProviderSettingsListProps {
  readonly keyStatuses: readonly MaskedSecretStatus[];
  readonly presets?: readonly ProviderPreset[];
  readonly onConnect: (providerId: string) => void;
  readonly onDisconnect: (providerId: string) => void;
}

function getTypeLabel(preset: ProviderPreset): string {
  if (preset.billingMode === 'local-free') return 'Local';
  if (preset.id === 'custom') return '自定义';
  return 'API 密钥';
}

export function ProviderSettingsList({
  keyStatuses,
  presets = PROVIDER_PRESETS,
  onConnect,
  onDisconnect,
}: ProviderSettingsListProps): ReactElement {
  const connectedSet = new Set(
    keyStatuses
      .filter((k) => k.status === 'configured' || k.status === 'memory-only')
      .map((k) => k.providerId),
  );

  const connected = presets.filter((p) => connectedSet.has(p.id));
  const unconnected = presets.filter((p) => !connectedSet.has(p.id));

  const renderRow = (preset: ProviderPreset, isConnected: boolean): ReactNode => (
    <div
      key={preset.id}
      className={`provider-settings-row${isConnected ? ' provider-settings-row-connected' : ''}`}
      data-testid={`provider-row-${preset.id}`}
    >
      <div className="provider-settings-row-info">
        <span className="provider-settings-row-name">{preset.displayName}</span>
        <span className="provider-settings-row-type">{getTypeLabel(preset)}</span>
      </div>
      <div className="provider-settings-row-action">
        {isConnected ? (
          <button
            type="button"
            className="provider-settings-disconnect-btn"
            data-testid={`provider-disconnect-${preset.id}`}
            onClick={() => onDisconnect(preset.id)}
          >
            断开连接
          </button>
        ) : (
          <button
            type="button"
            className="provider-settings-connect-btn"
            data-testid={`provider-connect-${preset.id}`}
            onClick={() => onConnect(preset.id)}
          >
            连接
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="provider-settings-list" data-testid="provider-settings-list">
      {connected.length > 0 && (
        <section className="provider-settings-section">
          <h4 className="provider-settings-section-title">已连接的提供商</h4>
          {connected.map((p) => renderRow(p, true))}
        </section>
      )}

      <section className="provider-settings-section">
        <h4 className="provider-settings-section-title">热门提供商</h4>
        {unconnected.map((p) => renderRow(p, false))}
      </section>
    </div>
  );
}
