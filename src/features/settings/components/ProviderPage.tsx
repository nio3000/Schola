/**
 * ProviderPage — provider configuration panel.
 *
 * Lists provider presets, shows API key status (masked), allows enable/disable.
 * Uses schola-api settings namespace for data.
 *
 * Key invariants:
 * - API keys displayed ONLY in masked format ("sk-...abc4")
 * - Never display full API key
 * - Add key form disabled when preload not wired
 * - Enable/disable toggle works only when backend is available
 * - No "provider-ready", "marketplace-ready", "runtime-ready" text
 */

import { useCallback, useState, type FormEvent, type ReactElement } from 'react';
import type { MaskedSecretStatus, ProviderConfig } from '../../../lib/contracts/settings.types';
import type { ProviderPreset } from '../../../lib/contracts/provider-preset.types';
import {
  clearApiKey,
  setApiKey,
  setProviderConfig,
} from '../../../lib/platform/settings-api';

export interface ProviderPageProps {
  readonly presets: readonly ProviderPreset[];
  readonly configs: readonly ProviderConfig[];
  readonly keyStatuses: readonly MaskedSecretStatus[];
  readonly onRefresh: () => void;
}

function getConfigForProvider(
  providerId: string,
  configs: readonly ProviderConfig[],
): ProviderConfig | undefined {
  return configs.find((c) => c.providerId === providerId);
}

function getKeyStatusForProvider(
  providerId: string,
  keyStatuses: readonly MaskedSecretStatus[],
): MaskedSecretStatus | undefined {
  return keyStatuses.find((k) => k.providerId === providerId);
}

export function ProviderPage({
  presets,
  configs,
  keyStatuses,
  onRefresh,
}: ProviderPageProps): ReactElement {
  const [addKeyProviderId, setAddKeyProviderId] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleToggleEnabled = useCallback(
    async (providerId: string, currentlyEnabled: boolean) => {
      setActionError(null);
      setActionLoading(providerId);
      try {
        await setProviderConfig(providerId, { enabled: !currentlyEnabled });
        onRefresh();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : '更新提供者配置失败',
        );
      } finally {
        setActionLoading(null);
      }
    },
    [onRefresh],
  );

  const handleSaveKey = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!addKeyProviderId || !keyInput.trim()) return;

      setActionError(null);
      setActionLoading(`key-${addKeyProviderId}`);
      try {
        await setApiKey(addKeyProviderId, keyInput.trim());
        setKeyInput('');
        setAddKeyProviderId(null);
        onRefresh();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : '保存 API Key 失败',
        );
      } finally {
        setActionLoading(null);
      }
    },
    [addKeyProviderId, keyInput, onRefresh],
  );

  const handleClearKey = useCallback(
    async (providerId: string) => {
      setActionError(null);
      setActionLoading(`clear-${providerId}`);
      try {
        await clearApiKey(providerId);
        onRefresh();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : '清除 API Key 失败',
        );
      } finally {
        setActionLoading(null);
      }
    },
    [onRefresh],
  );

  return (
    <div className="settings-page-content" data-testid="settings-provider-page">
      <h2 className="settings-page-title">提供者</h2>
      <p className="settings-page-desc">
        管理 AI 提供者配置与 API Key。所有密钥仅存储在本地，不会上传。
      </p>

      {actionError && (
        <div className="settings-error-banner" data-testid="settings-provider-error">
          <span>{actionError}</span>
        </div>
      )}

      {presets.length === 0 && (
        <div className="settings-empty" data-testid="settings-provider-empty">
          <p>暂无可用提供者。后端服务可能未就绪。</p>
        </div>
      )}

      <ul className="settings-provider-list">
        {presets.map((preset) => {
          const config = getConfigForProvider(preset.id, configs);
          const keyStatus = getKeyStatusForProvider(preset.id, keyStatuses);
          const enabled = config?.enabled ?? false;
          const isProcessing = actionLoading === preset.id;
          const isKeyProcessing = actionLoading === `key-${preset.id}`;
          const isClearProcessing = actionLoading === `clear-${preset.id}`;

          return (
            <li
              key={preset.id}
              className="settings-provider-item"
              data-testid={`settings-provider-${preset.id}`}
            >
              <div className="settings-provider-header">
                <span className="settings-provider-name">{preset.displayName}</span>
                <span
                  className={`settings-provider-badge ${
                    preset.billingMode === 'byok'
                      ? 'settings-badge-byok'
                      : preset.billingMode === 'local-free'
                        ? 'settings-badge-local'
                        : 'settings-badge-managed'
                  }`}
                >
                  {preset.billingMode === 'byok'
                    ? 'BYOK'
                    : preset.billingMode === 'local-free'
                      ? '本地免费'
                      : 'Schola'}
                </span>
              </div>

              <p className="settings-provider-desc">{preset.description}</p>

              <div className="settings-provider-meta">
                <span className="settings-provider-meta-item">
                  协议: {preset.protocol}
                </span>
                <span className="settings-provider-meta-item">
                  默认模型: {preset.defaultModel}
                </span>
              </div>

              <div className="settings-provider-key-status">
                <span className="settings-provider-key-label">API Key:</span>
                {keyStatus?.status === 'configured' ? (
                  <span className="settings-provider-key-value settings-key-configured">
                    {keyStatus.maskedSuffix ?? '已配置'}
                    {keyStatus.storageType === 'safeStorage' && (
                      <span
                        className="settings-key-storage-badge"
                        title="使用系统安全存储加密"
                      >
                        {'\uD83D\uDD12'}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="settings-provider-key-value settings-key-none">
                    未配置
                  </span>
                )}
              </div>

              <div className="settings-provider-actions">
                <button
                  type="button"
                  className={`settings-btn settings-btn-toggle ${enabled ? 'settings-btn-active' : ''}`}
                  data-testid={`settings-provider-toggle-${preset.id}`}
                  disabled={isProcessing}
                  onClick={() => handleToggleEnabled(preset.id, enabled)}
                >
                  {isProcessing ? '...' : enabled ? '已启用' : '已禁用'}
                </button>

                {preset.billingMode === 'byok' && (
                  <>
                    {addKeyProviderId === preset.id ? (
                      <form
                        className="settings-key-form"
                        onSubmit={handleSaveKey}
                        data-testid={`settings-key-form-${preset.id}`}
                      >
                        <input
                          type="password"
                          className="settings-key-input"
                          placeholder="输入 API Key..."
                          value={keyInput}
                          onChange={(e) => setKeyInput(e.target.value)}
                          autoFocus
                          data-testid={`settings-key-input-${preset.id}`}
                        />
                        <button
                          type="submit"
                          className="settings-btn settings-btn-primary"
                          disabled={isKeyProcessing || !keyInput.trim()}
                        >
                          {isKeyProcessing ? '...' : '保存'}
                        </button>
                        <button
                          type="button"
                          className="settings-btn settings-btn-secondary"
                          onClick={() => {
                            setAddKeyProviderId(null);
                            setKeyInput('');
                          }}
                        >
                          取消
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="settings-btn settings-btn-secondary"
                        data-testid={`settings-provider-setkey-${preset.id}`}
                        onClick={() => setAddKeyProviderId(preset.id)}
                      >
                        {keyStatus?.status === 'configured' ? '更换 Key' : '设置 Key'}
                      </button>
                    )}

                    {keyStatus?.status === 'configured' && (
                      <button
                        type="button"
                        className="settings-btn settings-btn-danger"
                        data-testid={`settings-provider-clearkey-${preset.id}`}
                        disabled={isClearProcessing}
                        onClick={() => handleClearKey(preset.id)}
                      >
                        {isClearProcessing ? '...' : '清除'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
