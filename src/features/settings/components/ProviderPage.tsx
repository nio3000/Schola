import { useCallback, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import type { MaskedSecretStatus, ProviderConfig } from '../../../lib/contracts/settings.types';
import type { ProviderPreset } from '../../../lib/contracts/provider-preset.types';
import {
  clearApiKey,
  fetchProviderModels,
  setApiKey,
  setProviderConfig,
  testProviderLatency,
} from '../../../lib/platform/settings-api';

export interface ProviderPageProps {
  readonly presets: readonly ProviderPreset[];
  readonly configs: readonly ProviderConfig[];
  readonly keyStatuses: readonly MaskedSecretStatus[];
  readonly onRefresh: () => void;
}

const PROVIDER_HOME: Record<string, string> = {
  openai: 'https://platform.openai.com',
  deepseek: 'https://platform.deepseek.com',
  openrouter: 'https://openrouter.ai',
  anthropic: 'https://console.anthropic.com',
  ollama: 'https://ollama.com',
  moonshot: 'https://platform.moonshot.cn',
  zhipu: 'https://open.bigmodel.cn',
  qwen: 'https://dashscope.aliyun.com',
  mimo: 'https://www.mi.com',
  minimax: 'https://www.minimax.io',
};

function getConfig(
  providerId: string,
  configs: readonly ProviderConfig[],
): ProviderConfig | undefined {
  return configs.find((config) => config.providerId === providerId);
}

function getKeyStatus(
  providerId: string,
  keyStatuses: readonly MaskedSecretStatus[],
): MaskedSecretStatus | undefined {
  return keyStatuses.find((status) => status.providerId === providerId);
}

function isKeyActive(status: MaskedSecretStatus | undefined): boolean {
  return status?.status === 'configured' || status?.status === 'memory-only';
}

function getKeyStatusLabel(status: MaskedSecretStatus | undefined): string {
  if (!status) return '未配置';
  if (status.status === 'configured') return `已安全存储 ${status.maskedSuffix ?? ''}`.trim();
  if (status.status === 'memory-only') return `仅内存 ${status.maskedSuffix ?? '***'}`;
  if (status.status === 'unavailable') return '系统密钥存储不可用';
  return '未配置';
}

export function ProviderPage({
  presets,
  configs,
  keyStatuses,
  onRefresh,
}: ProviderPageProps): ReactElement {
  const [activeTab, setActiveTab] = useState<'codex' | 'unified'>('codex');
  const [selectedProviderId, setSelectedProviderId] = useState(presets[0]?.id ?? 'openai');
  const [baseUrlDrafts, setBaseUrlDrafts] = useState<Record<string, string>>({});
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const selectedPreset = presets.find((preset) => preset.id === selectedProviderId) ?? presets[0];
  const selectedConfig = selectedPreset ? getConfig(selectedPreset.id, configs) : undefined;
  const selectedKeyStatus = selectedPreset
    ? getKeyStatus(selectedPreset.id, keyStatuses)
    : undefined;
  const selectedBaseUrl =
    (selectedPreset ? baseUrlDrafts[selectedPreset.id] : undefined) ??
    selectedConfig?.baseUrl ??
    selectedConfig?.customBaseURL ??
    selectedPreset?.baseURL ??
    '';
  const selectedModels = selectedConfig?.remoteModels ?? [];
  const selectedRemoteModelIds = new Set(selectedModels.map((model) => model.id));
  const selectedModel =
    selectedConfig?.selectedModel && selectedRemoteModelIds.has(selectedConfig.selectedModel)
      ? selectedConfig.selectedModel
      : (selectedModels[0]?.id ?? '尚未选择远程模型');

  const providerGroups = useMemo(
    () => ({
      codex: presets.filter((preset) => preset.id !== 'ollama'),
      unified: presets,
    }),
    [presets],
  );
  const visiblePresets = activeTab === 'codex' ? providerGroups.codex : providerGroups.unified;

  const handleSaveKey = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!selectedPreset) return;
      const key = keyDrafts[selectedPreset.id]?.trim();
      if (!key) return;
      setError(null);
      setMessage(null);
      setLoadingAction('save-key');
      try {
        await setApiKey(selectedPreset.id, key);
        setKeyDrafts((current) => ({ ...current, [selectedPreset.id]: '' }));
        setMessage('API Key 已保存，输入框已清空。');
        onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存 API Key 失败');
      } finally {
        setLoadingAction(null);
      }
    },
    [keyDrafts, onRefresh, selectedPreset],
  );

  const handleClearKey = useCallback(async () => {
    if (!selectedPreset) return;
    setError(null);
    setMessage(null);
    setLoadingAction('clear-key');
    try {
      await clearApiKey(selectedPreset.id);
      setMessage('API Key 已清除。');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '清除 API Key 失败');
    } finally {
      setLoadingAction(null);
    }
  }, [onRefresh, selectedPreset]);

  const handleFetchModels = useCallback(async () => {
    if (!selectedPreset) return;
    setError(null);
    setMessage(null);
    setLoadingAction('fetch-models');
    try {
      const result = await fetchProviderModels({
        providerId: selectedPreset.id,
        baseUrl: selectedBaseUrl,
        apiKey: keyDrafts[selectedPreset.id]?.trim() || undefined,
      });
      if (result.ok) {
        setMessage(`已获取 ${result.models.length} 个模型，用时 ${result.latencyMs} ms。`);
        onRefresh();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取模型列表失败');
    } finally {
      setLoadingAction(null);
    }
  }, [keyDrafts, onRefresh, selectedBaseUrl, selectedPreset]);

  const handleLatencyTest = useCallback(async () => {
    if (!selectedPreset) return;
    setError(null);
    setMessage(null);
    setLoadingAction('latency');
    try {
      const result = await testProviderLatency({
        providerId: selectedPreset.id,
        baseUrl: selectedBaseUrl,
        apiKey: keyDrafts[selectedPreset.id]?.trim() || undefined,
      });
      if (result.ok) {
        setMessage(`测速成功：${result.latencyMs} ms。`);
        onRefresh();
      } else {
        setError(`${result.error}${result.latencyMs ? ` (${result.latencyMs} ms)` : ''}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '测速失败');
    } finally {
      setLoadingAction(null);
    }
  }, [keyDrafts, onRefresh, selectedBaseUrl, selectedPreset]);

  const handleSelectModel = useCallback(
    async (modelId: string) => {
      if (!selectedPreset) return;
      setError(null);
      setMessage(null);
      setLoadingAction(`model-${modelId}`);
      try {
        await setProviderConfig(selectedPreset.id, {
          baseUrl: selectedBaseUrl,
          customBaseURL: selectedBaseUrl,
          selectedModel: modelId,
          enabled: true,
        });
        setMessage(`当前模型已保存：${modelId}`);
        onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存模型失败');
      } finally {
        setLoadingAction(null);
      }
    },
    [onRefresh, selectedBaseUrl, selectedPreset],
  );

  if (!selectedPreset) {
    return (
      <div className="settings-page-content" data-testid="settings-provider-page">
        <h2 className="settings-page-title">模型供应商 / Model Supplier Settings</h2>
        <p className="settings-page-desc">暂无可用 Provider。</p>
      </div>
    );
  }

  return (
    <div className="settings-page-content" data-testid="settings-provider-page">
      <h2 className="settings-page-title">模型供应商 / Model Supplier Settings</h2>
      <p className="settings-page-desc">
        配置模型供应商、API 请求地址、模型列表和服务器延迟。模型获取与测速只在你点击按钮时发生。
      </p>

      <div className="settings-provider-tabs" data-testid="provider-settings-tabs">
        <button
          type="button"
          className={`settings-btn ${activeTab === 'codex' ? 'settings-btn-active' : ''}`}
          onClick={() => setActiveTab('codex')}
        >
          Codex 供应商
        </button>
        <button
          type="button"
          className={`settings-btn ${activeTab === 'unified' ? 'settings-btn-active' : ''}`}
          onClick={() => setActiveTab('unified')}
        >
          统一供应商
        </button>
      </div>

      <div className="settings-provider-chip-list" data-testid="provider-preset-chips">
        {visiblePresets.map((preset) => {
          const config = getConfig(preset.id, configs);
          const keyStatus = getKeyStatus(preset.id, keyStatuses);
          const active = preset.id === selectedPreset.id;
          const enabled = config?.enabled ?? preset.id === 'ollama';
          return (
            <button
              key={preset.id}
              type="button"
              className={`settings-provider-chip ${active ? 'settings-provider-chip-active' : ''}`}
              data-testid={`provider-chip-${preset.id}`}
              onClick={() => setSelectedProviderId(preset.id)}
            >
              <span>{preset.displayName}</span>
              <small>
                {enabled ? '启用' : '禁用'} ·{' '}
                {isKeyActive(keyStatus) || preset.authType === 'none' ? '可用' : '缺 Key'}
              </small>
            </button>
          );
        })}
      </div>

      <div className="settings-notice" data-testid="settings-byok-notice">
        <span className="settings-notice-icon">i</span>
        <div className="settings-notice-body">
          <p className="settings-notice-title">BYOK 本地安全存储</p>
          <p className="settings-notice-desc">
            Schola 不内置密钥。API Key 仅用于 main process 的 models endpoint
            请求或延迟测试，不会返回 renderer 明文。
          </p>
        </div>
      </div>

      {message && (
        <div className="settings-success-banner" data-testid="settings-provider-message">
          {message}
        </div>
      )}
      {error && (
        <div className="settings-error-banner" data-testid="settings-provider-error">
          {error}
        </div>
      )}

      <section className="settings-section" data-testid="provider-config-detail">
        <div className="settings-provider-header">
          <div>
            <h3 className="settings-section-title">{selectedPreset.displayName}</h3>
            <p className="settings-section-desc">{selectedPreset.description}</p>
          </div>
          <a
            className="settings-provider-link"
            href={PROVIDER_HOME[selectedPreset.id] ?? selectedPreset.baseURL}
            target="_blank"
            rel="noreferrer"
          >
            官网链接
          </a>
        </div>

        <div className="settings-field">
          <label className="settings-field-label" htmlFor="provider-base-url">
            API 请求地址
          </label>
          <input
            id="provider-base-url"
            className="settings-input"
            data-testid="provider-base-url-input"
            value={selectedBaseUrl}
            onChange={(event) =>
              setBaseUrlDrafts((current) => ({
                ...current,
                [selectedPreset.id]: event.target.value,
              }))
            }
          />
        </div>

        <form className="settings-key-form" onSubmit={handleSaveKey}>
          <label className="settings-field-label" htmlFor="provider-api-key">
            API Key
          </label>
          <input
            id="provider-api-key"
            type="password"
            className="settings-key-input"
            data-testid="provider-api-key-input"
            value={keyDrafts[selectedPreset.id] ?? ''}
            placeholder={getKeyStatusLabel(selectedKeyStatus)}
            onChange={(event) =>
              setKeyDrafts((current) => ({ ...current, [selectedPreset.id]: event.target.value }))
            }
          />
          <button
            type="submit"
            className="settings-btn settings-btn-primary"
            disabled={loadingAction === 'save-key' || !(keyDrafts[selectedPreset.id] ?? '').trim()}
          >
            {loadingAction === 'save-key' ? '保存中' : '保存 Key'}
          </button>
          {isKeyActive(selectedKeyStatus) && (
            <button
              type="button"
              className="settings-btn settings-btn-danger"
              disabled={loadingAction === 'clear-key'}
              onClick={handleClearKey}
            >
              清除 Key
            </button>
          )}
        </form>

        <div className="settings-provider-actions">
          <button
            type="button"
            className="settings-btn settings-btn-primary"
            data-testid="fetch-provider-models-button"
            disabled={loadingAction === 'fetch-models'}
            onClick={handleFetchModels}
          >
            {loadingAction === 'fetch-models' ? '获取中' : '获取模型列表'}
          </button>
          <button
            type="button"
            className="settings-btn settings-btn-secondary"
            data-testid="test-provider-latency-button"
            disabled={loadingAction === 'latency'}
            onClick={handleLatencyTest}
          >
            {loadingAction === 'latency' ? '测速中' : '管理与测速'}
          </button>
          <span className="settings-provider-meta-item" data-testid="provider-latency-status">
            {selectedConfig?.lastLatencyMs ? `${selectedConfig.lastLatencyMs} ms` : '尚未测速'}
          </span>
        </div>
      </section>

      <section className="settings-section" data-testid="provider-model-list">
        <h3 className="settings-section-title">模型映射 / 模型选择</h3>
        <p className="settings-section-desc">
          当前选中模型：
          <strong data-testid="provider-selected-model">{selectedModel}</strong>
        </p>
        {selectedModels.length > 0 ? (
          <div className="settings-model-grid">
            {selectedModels.map((model) => (
              <button
                key={model.id}
                type="button"
                className={`settings-model-option ${model.id === selectedModel ? 'settings-model-option-active' : ''}`}
                data-testid={`provider-model-${model.id}`}
                disabled={loadingAction === `model-${model.id}`}
                onClick={() => handleSelectModel(model.id)}
              >
                <span>{model.displayName}</span>
                <small>
                  {model.contextWindow ? `${model.contextWindow} context` : '上下文窗口未知'}
                </small>
                {model.ownedBy && <small>{model.ownedBy}</small>}
              </button>
            ))}
          </div>
        ) : (
          <div className="settings-empty" data-testid="provider-remote-model-empty">
            <p>尚未获取当前供应商的远程模型列表。请先点击“获取模型列表”。</p>
          </div>
        )}

        <p className="settings-section-desc">
          最近获取：{selectedConfig?.lastModelFetchAt ?? '尚未获取'}。
        </p>
      </section>
    </div>
  );
}
