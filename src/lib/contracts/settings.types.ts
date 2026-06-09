/**
 * Settings / Provider / API Key / Context Confirmation — Phase 5-1.
 *
 * All types for the Settings Center, Provider Configuration,
 * API Key secure storage, Privacy Consent, and Context Confirmation.
 *
 * Key invariants:
 * - NO API keys in any type exported to renderer
 * - All IPC is fixed-function (no generic invoke)
 * - Privacy consent is persistent and versioned
 * - Context confirmation log contains metadata ONLY (no content, no paths, no secrets)
 */
import type { AIModelInfo } from './ai-provider.types';
import type { ProviderPreset } from './provider-preset.types';
import type { ContextFileRefSummary } from './context-pack.types';

// ═══════════════════════════════════════════════════════
// Settings Page Structure
// ═══════════════════════════════════════════════════════

export type SettingsPageId =
  | 'general'
  | 'ai'
  | 'provider'
  | 'model'
  | 'privacy'
  | 'export'
  | 'plugin'
  | 'about';

export interface SettingsSection {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface SettingsPage {
  readonly id: SettingsPageId;
  readonly label: string;
  readonly icon: string;
  /** Whether this page is fully interactive or a placeholder. */
  readonly phase: '5-1-interactive' | '5-1-placeholder';
  readonly sections: readonly SettingsSection[];
}

export const SETTINGS_PAGES: readonly SettingsPage[] = [
  {
    id: 'general',
    label: '通用',
    icon: '\u2699\uFE0F',
    phase: '5-1-interactive',
    sections: [
      { id: 'appearance', label: '外观' },
      { id: 'editor', label: '编辑器' },
      { id: 'vault', label: 'Vault' },
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    icon: '\uD83E\uDD16',
    phase: '5-1-interactive',
    sections: [
      { id: 'general', label: '通用' },
      { id: 'defaults', label: '默认设置' },
    ],
  },
  {
    id: 'provider',
    label: '提供者',
    icon: '\uD83D\uDD0C',
    phase: '5-1-interactive',
    sections: [
      { id: 'list', label: '提供者列表' },
    ],
  },
  {
    id: 'model',
    label: 'Model',
    icon: '\uD83E\uDDE0',
    phase: '5-1-placeholder',
    sections: [],
  },
  {
    id: 'privacy',
    label: '隐私',
    icon: '\uD83D\uDD12',
    phase: '5-1-interactive',
    sections: [
      { id: 'consent', label: '同意管理' },
      { id: 'policy', label: '发送策略' },
      { id: 'log', label: '确认日志' },
    ],
  },
  {
    id: 'export',
    label: '导出',
    icon: '\uD83D\uDCE4',
    phase: '5-1-placeholder',
    sections: [],
  },
  {
    id: 'plugin',
    label: '插件',
    icon: '\uD83E\uDDE9',
    phase: '5-1-placeholder',
    sections: [],
  },
  {
    id: 'about',
    label: '关于',
    icon: '\u2139\uFE0F',
    phase: '5-1-interactive',
    sections: [],
  },
];

// ═══════════════════════════════════════════════════════
// Provider Config (extends ProviderPreset, no secrets)
// ═══════════════════════════════════════════════════════

export interface ProviderConfig {
  readonly providerId: string;
  readonly displayName?: string;
  readonly customBaseURL?: string;
  readonly customModels?: readonly string[];
  readonly enabled: boolean;
  readonly updatedAt: string;
}

export function createDefaultProviderConfig(providerId: string): ProviderConfig {
  return {
    providerId,
    enabled: providerId === 'ollama',
    updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════
// API Key Status (renderer-safe — NEVER contains raw key)
// ═══════════════════════════════════════════════════════

export type SecretStatus = 'not-configured' | 'configured' | 'invalid';

export type SecretStorageType = 'safeStorage' | 'memory';

export interface MaskedSecretStatus {
  readonly providerId: string;
  readonly status: SecretStatus;
  /** Masked suffix like "sk-...abc4". NEVER the full key. Max 12 chars. */
  readonly maskedSuffix?: string;
  /** Storage backend used. Informational for UI display. */
  readonly storageType?: SecretStorageType;
}

export function createNotConfiguredStatus(providerId: string): MaskedSecretStatus {
  return { providerId, status: 'not-configured' };
}

export function createConfiguredStatus(
  providerId: string,
  maskedSuffix: string,
  storageType: SecretStorageType,
): MaskedSecretStatus {
  return { providerId, status: 'configured', maskedSuffix, storageType };
}

/** Mask a key for renderer display: keep prefix and suffix, hide middle. */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return '***';
  const prefix = key.slice(0, 3);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

// ═══════════════════════════════════════════════════════
// Privacy Consent
// ═══════════════════════════════════════════════════════

export type ContextSendPolicy =
  | 'never'
  | 'always-ask'
  | 'always-allow-local';

export interface PrivacyConsentState {
  readonly privacyConsentAccepted: boolean;
  readonly privacyConsentVersion: string;
  readonly privacyConsentAcceptedAt: string;
  readonly allowRemoteProvider: boolean;
  readonly defaultContextSendPolicy: ContextSendPolicy;
}

export const CURRENT_PRIVACY_CONSENT_VERSION = '1.0';

export function createDefaultPrivacyConsentState(): PrivacyConsentState {
  return {
    privacyConsentAccepted: false,
    privacyConsentVersion: '',
    privacyConsentAcceptedAt: '',
    allowRemoteProvider: false,
    defaultContextSendPolicy: 'always-ask',
  };
}

export function createAcceptedPrivacyConsentState(
  allowRemote: boolean,
): PrivacyConsentState {
  return {
    privacyConsentAccepted: true,
    privacyConsentVersion: CURRENT_PRIVACY_CONSENT_VERSION,
    privacyConsentAcceptedAt: new Date().toISOString(),
    allowRemoteProvider: allowRemote,
    defaultContextSendPolicy: 'always-ask',
  };
}

/** Check if consent needs re-confirmation (version bump). */
export function isConsentStale(consent: PrivacyConsentState): boolean {
  return consent.privacyConsentVersion !== CURRENT_PRIVACY_CONSENT_VERSION;
}

// ═══════════════════════════════════════════════════════
// AI Preferences
// ═══════════════════════════════════════════════════════

export interface AIPreferences {
  readonly aiEnabled: boolean;
  readonly defaultProviderId: string | null;
  readonly defaultModel: string | null;
  readonly updatedAt: string;
}

export function createDefaultAIPreferences(): AIPreferences {
  return {
    aiEnabled: false,
    defaultProviderId: null,
    defaultModel: null,
    updatedAt: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════
// Confirmation Log (metadata only — no content, no paths, no secrets)
// ═══════════════════════════════════════════════════════

export interface ConfirmationLogEntry {
  readonly id: string;
  readonly confirmed: boolean;
  readonly confirmedAt: string;
  readonly providerId: string;
  readonly model: string;
  readonly fileCount: number;
  readonly totalTokens: number;
  readonly truncatedFileCount: number;
  readonly confirmationScope: 'per-request' | 'per-session';
  readonly vaultId?: string;
}

// ═══════════════════════════════════════════════════════
// Settings Error Codes
// ═══════════════════════════════════════════════════════

export enum SettingsErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  PROVIDER_NOT_FOUND = 'PROVIDER_NOT_FOUND',
  KEY_STORAGE_UNAVAILABLE = 'KEY_STORAGE_UNAVAILABLE',
  KEY_TOO_SHORT = 'KEY_TOO_SHORT',
  PRIVACY_CONSENT_REQUIRED = 'PRIVACY_CONSENT_REQUIRED',
  REMOTE_DISABLED = 'REMOTE_DISABLED',
  CONFIG_SAVE_FAILED = 'CONFIG_SAVE_FAILED',
  SETTINGS_ERROR = 'SETTINGS_ERROR',
}

// ═══════════════════════════════════════════════════════
// IPC Channel Constants
// ═══════════════════════════════════════════════════════

// ── Provider ──
export const SETTINGS_GET_PROVIDER_PRESETS_CHANNEL = 'settings:get-provider-presets';
export const SETTINGS_GET_PROVIDER_CONFIGS_CHANNEL = 'settings:get-provider-configs';
export const SETTINGS_SET_PROVIDER_CONFIG_CHANNEL = 'settings:set-provider-config';
export const SETTINGS_GET_PROVIDER_MODELS_CHANNEL = 'settings:get-provider-models';

// ── API Key ──
export const SETTINGS_GET_API_KEY_STATUS_CHANNEL = 'settings:get-api-key-status';
export const SETTINGS_SET_API_KEY_CHANNEL = 'settings:set-api-key';
export const SETTINGS_CLEAR_API_KEY_CHANNEL = 'settings:clear-api-key';

// ── Privacy ──
export const SETTINGS_GET_PRIVACY_CONSENT_CHANNEL = 'settings:get-privacy-consent';
export const SETTINGS_SET_PRIVACY_CONSENT_CHANNEL = 'settings:set-privacy-consent';

// ── Policy ──
export const SETTINGS_GET_CONTEXT_SEND_POLICY_CHANNEL = 'settings:get-context-send-policy';
export const SETTINGS_SET_CONTEXT_SEND_POLICY_CHANNEL = 'settings:set-context-send-policy';

// ── AI Preferences ──
export const SETTINGS_GET_AI_PREFERENCES_CHANNEL = 'settings:get-ai-preferences';
export const SETTINGS_SET_AI_PREFERENCES_CHANNEL = 'settings:set-ai-preferences';

// ── Confirmation Log ──
export const SETTINGS_GET_CONFIRMATION_LOG_CHANNEL = 'settings:get-confirmation-log';

// ── Error ──
export interface SettingsIpcError {
  readonly code: SettingsErrorCode;
  readonly message: string;
  readonly details?: string;
}

// ═══════════════════════════════════════════════════════
// Renderer-visible Settings API (preload contract)
// ═══════════════════════════════════════════════════════

export interface ScholaSettingsApi {
  // Provider
  readonly getProviderPresets: () => Promise<readonly ProviderPreset[]>;
  readonly getProviderConfigs: () => Promise<readonly ProviderConfig[]>;
  readonly setProviderConfig: (providerId: string, config: Partial<ProviderConfig>) => Promise<ProviderConfig>;
  readonly getProviderModels: (providerId: string) => Promise<readonly AIModelInfo[]>;

  // API Key (NEVER returns raw key)
  readonly getApiKeyStatus: (providerId?: string) => Promise<readonly MaskedSecretStatus[]>;
  readonly setApiKey: (providerId: string, key: string) => Promise<MaskedSecretStatus>;
  readonly clearApiKey: (providerId: string) => Promise<MaskedSecretStatus>;

  // Privacy
  readonly getPrivacyConsent: () => Promise<PrivacyConsentState | null>;
  readonly setPrivacyConsent: (consent: PrivacyConsentState) => Promise<PrivacyConsentState>;

  // Policy
  readonly getContextSendPolicy: () => Promise<ContextSendPolicy>;
  readonly setContextSendPolicy: (policy: ContextSendPolicy) => Promise<ContextSendPolicy>;

  // AI Preferences
  readonly getAIPreferences: () => Promise<AIPreferences>;
  readonly setAIPreferences: (prefs: Partial<AIPreferences>) => Promise<AIPreferences>;

  // Confirmation Log
  readonly getConfirmationLog: (limit?: number) => Promise<readonly ConfirmationLogEntry[]>;
}
