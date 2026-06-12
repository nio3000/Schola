/**
 * Settings IPC Handlers — Phase 5-1-IMP-4.
 *
 * Registers all 14 settings-related IPC handlers.
 * EVERY handler validates inputs, sanitizes errors, and NEVER returns raw API keys.
 */
import { ipcMain } from 'electron';
import type {
  ProviderConfig,
  PrivacyConsentState,
  AIPreferences,
  ConfirmationLogEntry,
  ContextSendPolicy,
  FetchProviderModelsInput,
  FetchProviderModelsResult,
  MaskedSecretStatus,
  TestProviderLatencyInput,
  TestProviderLatencyResult,
} from '../../src/lib/contracts/settings.types';
import type { ProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import type { AIModelInfo } from '../../src/lib/contracts/ai-provider.types';
import {
  SETTINGS_GET_PROVIDER_PRESETS_CHANNEL,
  SETTINGS_GET_PROVIDER_CONFIGS_CHANNEL,
  SETTINGS_SET_PROVIDER_CONFIG_CHANNEL,
  SETTINGS_GET_PROVIDER_MODELS_CHANNEL,
  SETTINGS_FETCH_PROVIDER_MODELS_CHANNEL,
  SETTINGS_TEST_PROVIDER_LATENCY_CHANNEL,
  SETTINGS_GET_API_KEY_STATUS_CHANNEL,
  SETTINGS_SET_API_KEY_CHANNEL,
  SETTINGS_CLEAR_API_KEY_CHANNEL,
  SETTINGS_GET_PRIVACY_CONSENT_CHANNEL,
  SETTINGS_SET_PRIVACY_CONSENT_CHANNEL,
  SETTINGS_GET_CONTEXT_SEND_POLICY_CHANNEL,
  SETTINGS_SET_CONTEXT_SEND_POLICY_CHANNEL,
  SETTINGS_GET_AI_PREFERENCES_CHANNEL,
  SETTINGS_SET_AI_PREFERENCES_CHANNEL,
  SETTINGS_GET_CONFIRMATION_LOG_CHANNEL,
} from '../../src/lib/contracts/settings.types';
import { PROVIDER_PRESETS, getProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import {
  getAllProviderConfigs,
  getProviderConfig,
  setProviderConfig as storeSetProviderConfig,
  getPrivacyConsent,
  setPrivacyConsent as storeSetPrivacyConsent,
  getContextSendPolicy,
  setContextSendPolicy as storeSetContextSendPolicy,
  getAIPreferences,
  setAIPreferences as storeSetAIPreferences,
  getConfirmationLog,
} from '../services/settings-store.service';
import {
  getProviderKeyStatus,
  setProviderKey,
  deleteProviderKey,
} from '../services/provider-key-store.service';
import { fetchProviderModels, testProviderLatency } from '../services/model-gateway.service';
import { assertString } from '../lib/ipc-validation';
import { sanitizeIpcError } from '../lib/error-utils';

// ── Helpers ──────────────────────────────────

/**
 * Build AIModelInfo entries by aggregating provider preset defaults
 * with any custom models from the user's provider config.
 */
function aggregateModels(providerId: string): readonly AIModelInfo[] {
  const preset = getProviderPreset(providerId);
  const config = getProviderConfig(providerId);

  if (!preset) {
    return [];
  }

  const models: AIModelInfo[] = [];
  const defaultCandidate = 'gpt5.5';

  models.push({
    id: defaultCandidate,
    providerId,
    displayName: 'GPT-5.5',
    contextWindow: 0,
    capabilities: preset ? [...preset.capabilities] : [],
  });

  // Preset default model
  if (preset && preset.defaultModel && preset.defaultModel !== defaultCandidate) {
    models.push({
      id: preset.defaultModel,
      providerId,
      displayName: preset.defaultModel,
      contextWindow: 0,
      capabilities: [...preset.capabilities],
    });
  }

  // Custom models from config
  if (config?.customModels) {
    for (const modelId of config.customModels) {
      // Skip if already added from preset
      if (models.some((m) => m.id === modelId)) continue;

      models.push({
        id: modelId,
        providerId,
        displayName: modelId,
        contextWindow: 0,
        capabilities: preset ? [...preset.capabilities] : [],
      });
    }
  }

  if (config?.remoteModels) {
    for (const model of config.remoteModels) {
      if (models.some((m) => m.id === model.id)) continue;
      models.push({
        id: model.id,
        providerId,
        displayName: model.displayName,
        contextWindow: model.contextWindow ?? 0,
        capabilities: preset ? [...preset.capabilities] : [],
      });
    }
  }

  return models;
}

function sanitizeFetchInput(input: unknown): FetchProviderModelsInput {
  if (!input || typeof input !== 'object') {
    throw new Error('INVALID_INPUT: input must be an object.');
  }
  const record = input as Partial<FetchProviderModelsInput>;
  return {
    providerId: assertString(record.providerId, 'providerId'),
    baseUrl: assertString(record.baseUrl, 'baseUrl'),
    apiKey: typeof record.apiKey === 'string' ? record.apiKey : undefined,
  };
}

function sanitizeLatencyInput(input: unknown): TestProviderLatencyInput {
  if (!input || typeof input !== 'object') {
    throw new Error('INVALID_INPUT: input must be an object.');
  }
  const record = input as Partial<TestProviderLatencyInput>;
  return {
    providerId: assertString(record.providerId, 'providerId'),
    baseUrl: assertString(record.baseUrl, 'baseUrl'),
    apiKey: typeof record.apiKey === 'string' ? record.apiKey : undefined,
  };
}

// ── Registration ──────────────────────────────

export function registerSettingsIpc(): void {
  // ── Provider Presets ──
  ipcMain.handle(SETTINGS_GET_PROVIDER_PRESETS_CHANNEL, (): readonly ProviderPreset[] => {
    return PROVIDER_PRESETS;
  });

  // ── Provider Configs (no secrets) ──
  ipcMain.handle(SETTINGS_GET_PROVIDER_CONFIGS_CHANNEL, (): readonly ProviderConfig[] => {
    return getAllProviderConfigs();
  });

  ipcMain.handle(
    SETTINGS_SET_PROVIDER_CONFIG_CHANNEL,
    (_event, providerId: unknown, config: unknown): ProviderConfig => {
      try {
        const id = assertString(providerId, 'providerId');
        const partial = (config as Partial<ProviderConfig>) ?? {};
        return storeSetProviderConfig(id, {
          displayName: partial.displayName,
          customBaseURL: partial.customBaseURL,
          baseUrl: partial.baseUrl,
          selectedModel: partial.selectedModel,
          customModels: partial.customModels,
          remoteModels: partial.remoteModels,
          lastModelFetchAt: partial.lastModelFetchAt,
          lastLatencyMs: partial.lastLatencyMs,
          lastLatencyTestAt: partial.lastLatencyTestAt,
          enabled: partial.enabled,
        });
      } catch (err) {
        const { message } = { message: sanitizeIpcError(err) };
        throw new Error(`SETTINGS_ERROR: ${message}`);
      }
    },
  );

  // ── Provider Models (aggregate preset + custom) ──
  ipcMain.handle(
    SETTINGS_GET_PROVIDER_MODELS_CHANNEL,
    (_event, providerId: unknown): readonly AIModelInfo[] => {
      try {
        const id = assertString(providerId, 'providerId');
        return aggregateModels(id);
      } catch {
        // For invalid providerId, return empty array rather than throwing
        return [];
      }
    },
  );

  ipcMain.handle(
    SETTINGS_FETCH_PROVIDER_MODELS_CHANNEL,
    async (_event, input: unknown): Promise<FetchProviderModelsResult> => {
      try {
        const safeInput = sanitizeFetchInput(input);
        const result = await fetchProviderModels(safeInput);
        if (result.ok) {
          storeSetProviderConfig(result.providerId, {
            baseUrl: safeInput.baseUrl,
            customBaseURL: safeInput.baseUrl,
            remoteModels: result.models,
            lastModelFetchAt: result.fetchedAt,
            enabled: true,
          });
        }
        return result;
      } catch (err) {
        const msg = sanitizeIpcError(err);
        return {
          ok: false,
          providerId: 'unknown',
          error: msg,
          errorCode: 'invalid_response',
        };
      }
    },
  );

  ipcMain.handle(
    SETTINGS_TEST_PROVIDER_LATENCY_CHANNEL,
    async (_event, input: unknown): Promise<TestProviderLatencyResult> => {
      try {
        const safeInput = sanitizeLatencyInput(input);
        const result = await testProviderLatency(safeInput);
        if (result.ok) {
          storeSetProviderConfig(result.providerId, {
            baseUrl: safeInput.baseUrl,
            customBaseURL: safeInput.baseUrl,
            lastLatencyMs: result.latencyMs,
            lastLatencyTestAt: result.testedAt,
          });
        }
        return result;
      } catch (err) {
        const msg = sanitizeIpcError(err);
        return {
          ok: false,
          providerId: 'unknown',
          error: msg,
          errorCode: 'invalid_response',
        };
      }
    },
  );

  // ── API Key Status (renderer-safe — NEVER returns raw key) ──
  ipcMain.handle(
    SETTINGS_GET_API_KEY_STATUS_CHANNEL,
    (_event, providerId: unknown): readonly MaskedSecretStatus[] => {
      if (typeof providerId === 'string' && providerId.trim().length > 0) {
        return getProviderKeyStatus(providerId);
      }
      return getProviderKeyStatus();
    },
  );

  ipcMain.handle(
    SETTINGS_SET_API_KEY_CHANNEL,
    (_event, providerId: unknown, key: unknown): MaskedSecretStatus => {
      try {
        const id = assertString(providerId, 'providerId');
        const keyStr = assertString(key, 'key');
        return setProviderKey(id, keyStr);
      } catch (err) {
        const msg = sanitizeIpcError(err);
        throw new Error(`SETTINGS_ERROR: ${msg}`);
      }
    },
  );

  ipcMain.handle(
    SETTINGS_CLEAR_API_KEY_CHANNEL,
    (_event, providerId: unknown): MaskedSecretStatus => {
      try {
        const id = assertString(providerId, 'providerId');
        return deleteProviderKey(id);
      } catch (err) {
        const msg = sanitizeIpcError(err);
        throw new Error(`SETTINGS_ERROR: ${msg}`);
      }
    },
  );

  // ── Privacy Consent ──
  ipcMain.handle(SETTINGS_GET_PRIVACY_CONSENT_CHANNEL, (): PrivacyConsentState => {
    return getPrivacyConsent();
  });

  ipcMain.handle(
    SETTINGS_SET_PRIVACY_CONSENT_CHANNEL,
    (_event, consent: unknown): PrivacyConsentState => {
      try {
        if (!consent || typeof consent !== 'object') {
          throw new Error('INVALID_INPUT: consent must be a valid PrivacyConsentState.');
        }
        return storeSetPrivacyConsent(consent as PrivacyConsentState);
      } catch (err) {
        const msg = sanitizeIpcError(err);
        throw new Error(`SETTINGS_ERROR: ${msg}`);
      }
    },
  );

  // ── Context Send Policy ──
  ipcMain.handle(SETTINGS_GET_CONTEXT_SEND_POLICY_CHANNEL, (): ContextSendPolicy => {
    return getContextSendPolicy();
  });

  ipcMain.handle(
    SETTINGS_SET_CONTEXT_SEND_POLICY_CHANNEL,
    (_event, policy: unknown): ContextSendPolicy => {
      try {
        const p = assertString(policy, 'policy') as ContextSendPolicy;
        return storeSetContextSendPolicy(p);
      } catch (err) {
        const msg = sanitizeIpcError(err);
        throw new Error(`SETTINGS_ERROR: ${msg}`);
      }
    },
  );

  // ── AI Preferences ──
  ipcMain.handle(SETTINGS_GET_AI_PREFERENCES_CHANNEL, (): AIPreferences => {
    return getAIPreferences();
  });

  ipcMain.handle(SETTINGS_SET_AI_PREFERENCES_CHANNEL, (_event, prefs: unknown): AIPreferences => {
    try {
      const partial = (prefs as Partial<AIPreferences>) ?? {};
      return storeSetAIPreferences({
        aiEnabled: partial.aiEnabled,
        defaultProviderId: partial.defaultProviderId,
        defaultModel: partial.defaultModel,
      });
    } catch (err) {
      const msg = sanitizeIpcError(err);
      throw new Error(`SETTINGS_ERROR: ${msg}`);
    }
  });

  // ── Confirmation Log ──
  ipcMain.handle(
    SETTINGS_GET_CONFIRMATION_LOG_CHANNEL,
    (_event, limit: unknown): readonly ConfirmationLogEntry[] => {
      if (typeof limit === 'number' && limit > 0) {
        return getConfirmationLog(Math.floor(limit));
      }
      return getConfirmationLog();
    },
  );
}
