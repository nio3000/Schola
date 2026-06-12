/**
 * AIPage — AI settings panel.
 *
 * Displays AI preferences with interactive provider/model selection.
 *
 * Key invariants:
 * - No real provider calls
 * - Provider/model selection persists via settings API
 */

import { useCallback, useState, type ReactElement } from 'react';
import type {
  AIPreferences,
  MaskedSecretStatus,
  ProviderConfig,
} from '../../../lib/contracts/settings.types';
import type { ProviderPreset } from '../../../lib/contracts/provider-preset.types';
import { setAIPreferences } from '../../../lib/platform/settings-api';

export interface AIPageProps {
  readonly aiPrefs: AIPreferences;
  readonly presets: readonly ProviderPreset[];
  readonly configs: readonly ProviderConfig[];
  readonly keyStatuses: readonly MaskedSecretStatus[];
  readonly onRefresh: () => void;
}

function getModelsForProvider(
  providerId: string,
  presets: readonly ProviderPreset[],
  configs: readonly ProviderConfig[],
): readonly string[] {
  const preset = presets.find((item) => item.id === providerId);
  const config = configs.find((item) => item.providerId === providerId);
  const models = new Set<string>(['gpt5.5']);
  if (preset?.defaultModel) models.add(preset.defaultModel);
  for (const modelId of config?.customModels ?? []) models.add(modelId);
  for (const model of config?.remoteModels ?? []) models.add(model.id);
  return Array.from(models);
}

export function AIPage({
  aiPrefs,
  presets,
  configs,
  keyStatuses,
  onRefresh,
}: AIPageProps): ReactElement {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledProviders = presets.filter((p) => {
    const config = configs.find((c) => c.providerId === p.id);
    return config?.enabled ?? false;
  });

  const handleSetDefaultProvider = useCallback(
    async (providerId: string) => {
      setError(null);
      setSaving(true);
      try {
        // When changing provider, reset model to persisted selected model or gpt5.5.
        const preset = presets.find((p) => p.id === providerId);
        const config = configs.find((item) => item.providerId === providerId);
        await setAIPreferences({
          ...aiPrefs,
          defaultProviderId: providerId,
          defaultModel: config?.selectedModel ?? preset?.defaultModel ?? 'gpt5.5',
        });
        onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存默认设置失败');
      } finally {
        setSaving(false);
      }
    },
    [aiPrefs, configs, presets, onRefresh],
  );

  const handleSetDefaultModel = useCallback(
    async (model: string) => {
      setError(null);
      setSaving(true);
      try {
        await setAIPreferences({
          ...aiPrefs,
          defaultModel: model,
        });
        onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : '保存模型设置失败');
      } finally {
        setSaving(false);
      }
    },
    [aiPrefs, onRefresh],
  );

  const availableModels = aiPrefs.defaultProviderId
    ? getModelsForProvider(aiPrefs.defaultProviderId, presets, configs)
    : [];

  return (
    <div className="settings-page-content" data-testid="settings-ai-page">
      <h2 className="settings-page-title">AI 偏好</h2>

      <div className="settings-notice" data-testid="settings-ai-notice">
        <span className="settings-notice-icon">{'\u2139\uFE0F'}</span>
        <div className="settings-notice-body">
          <p className="settings-notice-title">仅管理 AI 使用偏好</p>
          <p className="settings-notice-desc">
            这里只保存默认模型供应商、默认模型与启用偏好。API 请求地址、API Key、模型获取和测速在“模型供应商”页管理。
          </p>
        </div>
      </div>

      {error && (
        <div className="settings-error-banner" data-testid="settings-ai-error">
          <span>{error}</span>
        </div>
      )}

      <section className="settings-section" data-testid="settings-section-ai-general">
        <h3 className="settings-section-title">{'\uD83E\uDD16'} 通用</h3>
        <div className="settings-field">
          <span className="settings-field-label">AI 功能</span>
          <span
            className={`settings-field-value ${aiPrefs.aiEnabled ? 'settings-field-enabled' : 'settings-field-disabled'}`}
          >
            {aiPrefs.aiEnabled ? '已启用' : '已禁用'}
          </span>
        </div>
      </section>

      <section className="settings-section" data-testid="settings-section-ai-defaults">
        <h3 className="settings-section-title">{'\uD83C\uDFAF'} 默认设置</h3>
        <p className="settings-section-desc">
          选择默认的模型供应商和模型。这些设置作为工作台打开时的偏好，不包含连接密钥配置。
        </p>

        <div className="settings-field">
          <label className="settings-field-label" htmlFor="ai-default-provider">
            默认模型供应商
          </label>
          <select
            id="ai-default-provider"
            className="settings-select"
            data-testid="ai-default-provider-select"
            value={aiPrefs.defaultProviderId ?? ''}
            onChange={(e) => handleSetDefaultProvider(e.target.value)}
            disabled={saving || enabledProviders.length === 0}
          >
            <option value="">未设置</option>
            {enabledProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>

        {aiPrefs.defaultProviderId && (
          <div className="settings-field">
            <label className="settings-field-label" htmlFor="ai-default-model">
              默认模型
            </label>
            <select
              id="ai-default-model"
              className="settings-select"
              data-testid="ai-default-model-select"
              value={aiPrefs.defaultModel ?? ''}
              onChange={(e) => handleSetDefaultModel(e.target.value)}
              disabled={saving || availableModels.length === 0}
            >
              <option value="">选择模型</option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>
    </div>
  );
}
