/**
 * ModelSelector — Phase 5-UX-REBASE-IMP-CONTINUE.
 *
 * OpenCode-like Provider + Model dropdown selector.
 * Displays connected providers as selectable, unconnected as greyed out.
 *
 * Security: no dynamic network model fetch. Uses static PROVIDER_PRESETS.
 */

import { type ReactElement, useMemo } from 'react';
import type { ProviderPreset } from '../../../lib/contracts/provider-preset.types';
import type { MaskedSecretStatus } from '../../../lib/contracts/settings.types';
import { PROVIDER_PRESETS } from '../../../lib/contracts/provider-preset.types';

export interface ModelSelectorProps {
  readonly selectedProviderId: string | null;
  readonly selectedModel: string;
  readonly keyStatuses: readonly MaskedSecretStatus[];
  readonly onProviderChange: (providerId: string) => void;
  readonly onModelChange: (model: string) => void;
  readonly onConnectProvider: (providerId: string) => void;
}

function getModelsForProvider(providerId: string): readonly string[] {
  // Static model lists per provider preset
  const models: Record<string, readonly string[]> = {
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    deepseek: ['deepseek-chat', 'deepseek-reasoner'],
    openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet'],
    anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
    gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    ollama: ['llama3.2', 'mistral', 'codellama'],
    custom: ['custom-model'],
  };
  return models[providerId] ?? [];
}

export function ModelSelector({
  selectedProviderId,
  selectedModel,
  keyStatuses,
  onProviderChange,
  onModelChange,
  onConnectProvider,
}: ModelSelectorProps): ReactElement {
  const connectedSet = useMemo(
    () => new Set(keyStatuses.filter((k) => k.status === 'configured').map((k) => k.providerId)),
    [keyStatuses],
  );

  const isConnected = selectedProviderId ? connectedSet.has(selectedProviderId) : false;
  const availableModels = selectedProviderId ? getModelsForProvider(selectedProviderId) : [];

  return (
    <div className="model-selector" data-testid="model-selector">
      <div className="model-selector-row">
        <label className="model-selector-label">Provider</label>
        <select
          className="model-selector-dropdown"
          data-testid="model-selector-provider"
          value={selectedProviderId ?? ''}
          onChange={(e) => {
            const id = e.target.value;
            if (id && !connectedSet.has(id)) {
              onConnectProvider(id);
              return;
            }
            onProviderChange(id);
          }}
        >
          <option value="">选择 Provider</option>
          {PROVIDER_PRESETS.map((p) => {
            const conn = connectedSet.has(p.id);
            return (
              <option key={p.id} value={p.id}>
                {p.displayName} {conn ? '✓' : '🔒'}
              </option>
            );
          })}
        </select>
        {selectedProviderId && !isConnected && (
          <button
            type="button"
            className="model-selector-connect-btn"
            data-testid="model-selector-connect"
            onClick={() => onConnectProvider(selectedProviderId!)}
          >
            连接
          </button>
        )}
      </div>

      <div className="model-selector-row">
        <label className="model-selector-label">Model</label>
        <select
          className="model-selector-dropdown"
          data-testid="model-selector-model"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={!isConnected || availableModels.length === 0}
        >
          {availableModels.length === 0 ? (
            <option value="">{isConnected ? '暂无可用模型' : '请先连接 Provider'}</option>
          ) : (
            availableModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))
          )}
        </select>
        {isConnected && (
          <span className="model-selector-status-connected" data-testid="model-selector-status">
            ✓ 已连接
          </span>
        )}
      </div>
    </div>
  );
}
