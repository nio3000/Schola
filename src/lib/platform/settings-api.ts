/**
 * Settings API — wrapper around window.schola.settings.*
 *
 * Pattern: follows existing schola-api.ts wrappers.
 * All calls go through window.schola.settings.* (defined in ScholaSettingsApi contract).
 *
 * Error handling: functions throw with structured message on failure.
 * When the settings namespace is unavailable (preload not wired), returns sensible defaults.
 */

import type {
  AIPreferences,
  ConfirmationLogEntry,
  ContextSendPolicy,
  MaskedSecretStatus,
  PrivacyConsentState,
  ProviderConfig,
} from '../contracts/settings.types';
import type { AIModelInfo } from '../contracts/ai-provider.types';
import type { ProviderPreset } from '../contracts/provider-preset.types';

function getSettingsApi() {
  if (typeof window.schola?.settings === 'undefined') {
    throw new Error(
      '[settings-api] window.schola.settings is not available — preload may need updating.',
    );
  }
  return window.schola.settings;
}

// ── Provider ──

export async function getProviderPresets(): Promise<readonly ProviderPreset[]> {
  try {
    return getSettingsApi().getProviderPresets();
  } catch {
    return [];
  }
}

export async function getProviderConfigs(): Promise<readonly ProviderConfig[]> {
  try {
    return getSettingsApi().getProviderConfigs();
  } catch {
    return [];
  }
}

export async function setProviderConfig(
  providerId: string,
  config: Partial<ProviderConfig>,
): Promise<ProviderConfig> {
  return getSettingsApi().setProviderConfig(providerId, config);
}

export async function getProviderModels(
  providerId: string,
): Promise<readonly AIModelInfo[]> {
  try {
    return getSettingsApi().getProviderModels(providerId);
  } catch {
    return [];
  }
}

// ── API Key ──

export async function getApiKeyStatus(
  providerId?: string,
): Promise<readonly MaskedSecretStatus[]> {
  try {
    return getSettingsApi().getApiKeyStatus(providerId);
  } catch {
    return [];
  }
}

export async function setApiKey(
  providerId: string,
  key: string,
): Promise<MaskedSecretStatus> {
  return getSettingsApi().setApiKey(providerId, key);
}

export async function clearApiKey(
  providerId: string,
): Promise<MaskedSecretStatus> {
  return getSettingsApi().clearApiKey(providerId);
}

// ── Privacy ──

export async function getPrivacyConsent(): Promise<PrivacyConsentState | null> {
  try {
    return getSettingsApi().getPrivacyConsent();
  } catch {
    return null;
  }
}

export async function setPrivacyConsent(
  consent: PrivacyConsentState,
): Promise<PrivacyConsentState> {
  return getSettingsApi().setPrivacyConsent(consent);
}

// ── Policy ──

export async function getContextSendPolicy(): Promise<ContextSendPolicy> {
  try {
    return getSettingsApi().getContextSendPolicy();
  } catch {
    return 'always-ask';
  }
}

export async function setContextSendPolicy(
  policy: ContextSendPolicy,
): Promise<ContextSendPolicy> {
  return getSettingsApi().setContextSendPolicy(policy);
}

// ── AI Preferences ──

export async function getAIPreferences(): Promise<AIPreferences> {
  try {
    return getSettingsApi().getAIPreferences();
  } catch {
    return {
      aiEnabled: false,
      defaultProviderId: null,
      defaultModel: null,
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function setAIPreferences(
  prefs: Partial<AIPreferences>,
): Promise<AIPreferences> {
  return getSettingsApi().setAIPreferences(prefs);
}

// ── Confirmation Log ──

export async function getConfirmationLog(
  limit?: number,
): Promise<readonly ConfirmationLogEntry[]> {
  try {
    return getSettingsApi().getConfirmationLog(limit);
  } catch {
    return [];
  }
}
