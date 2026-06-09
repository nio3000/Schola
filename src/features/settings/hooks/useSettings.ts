/**
 * useSettings — central hook for Settings Center state management.
 *
 * Manages: activePage, providerConfigs, keyStatuses, privacyConsent, aiPrefs.
 * Fetches data on mount via settings-api wrappers.
 *
 * Key invariants:
 * - All fetches are fire-and-forget on mount; errors are caught per-call
 * - State defaults handle unavailable preload gracefully
 * - No API keys in state — only MaskedSecretStatus
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SettingsPageId } from '../../../lib/contracts/settings.types';
import type {
  AIPreferences,
  ConfirmationLogEntry,
  MaskedSecretStatus,
  PrivacyConsentState,
  ProviderConfig,
} from '../../../lib/contracts/settings.types';
import type { ProviderPreset } from '../../../lib/contracts/provider-preset.types';
import {
  getAIPreferences,
  getApiKeyStatus,
  getConfirmationLog,
  getPrivacyConsent,
  getProviderConfigs,
  getProviderPresets,
} from '../../../lib/platform/settings-api';

export interface UseSettingsState {
  readonly activePage: SettingsPageId;
  readonly setActivePage: (page: SettingsPageId) => void;
  readonly providerPresets: readonly ProviderPreset[];
  readonly providerConfigs: readonly ProviderConfig[];
  readonly keyStatuses: readonly MaskedSecretStatus[];
  readonly privacyConsent: PrivacyConsentState | null;
  readonly aiPrefs: AIPreferences;
  readonly confirmationLog: readonly ConfirmationLogEntry[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly refreshData: () => void;
}

async function fetchAllSettings(): Promise<{
  presets: readonly ProviderPreset[];
  configs: readonly ProviderConfig[];
  keys: readonly MaskedSecretStatus[];
  privacy: PrivacyConsentState | null;
  ai: AIPreferences;
  log: readonly ConfirmationLogEntry[];
  allFailed: boolean;
}> {
  const results = await Promise.allSettled([
    getProviderPresets(),
    getProviderConfigs(),
    getApiKeyStatus(),
    getPrivacyConsent(),
    getAIPreferences(),
    getConfirmationLog(20),
  ]);

  const [presets, configs, keys, privacy, ai, log] = results;

  const allFailed = results.every((r) => r.status === 'rejected');

  return {
    presets: presets.status === 'fulfilled' ? presets.value : [],
    configs: configs.status === 'fulfilled' ? configs.value : [],
    keys: keys.status === 'fulfilled' ? keys.value : [],
    privacy: privacy.status === 'fulfilled' ? privacy.value : null,
    ai: ai.status === 'fulfilled'
      ? ai.value
      : {
          aiEnabled: false,
          defaultProviderId: null,
          defaultModel: null,
          updatedAt: new Date().toISOString(),
        },
    log: log.status === 'fulfilled' ? log.value : [],
    allFailed,
  };
}

export function useSettings(): UseSettingsState {
  const [activePage, setActivePage] = useState<SettingsPageId>('general');
  const [providerPresets, setProviderPresets] = useState<readonly ProviderPreset[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<readonly ProviderConfig[]>([]);
  const [keyStatuses, setKeyStatuses] = useState<readonly MaskedSecretStatus[]>([]);
  const [privacyConsent, setPrivacyConsent] = useState<PrivacyConsentState | null>(null);
  const [aiPrefs, setAIPrefs] = useState<AIPreferences>({
    aiEnabled: false,
    defaultProviderId: null,
    defaultModel: null,
    updatedAt: new Date().toISOString(),
  });
  const [confirmationLog, setConfirmationLog] = useState<readonly ConfirmationLogEntry[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refreshData = useCallback(() => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    fetchAllSettings()
      .then((data) => {
        if (!mountedRef.current) return;
        setProviderPresets(data.presets);
        setProviderConfigs(data.configs);
        setKeyStatuses(data.keys);
        setPrivacyConsent(data.privacy);
        setAIPrefs(data.ai);
        setConfirmationLog(data.log);
        if (data.allFailed) {
          setError('无法加载设置数据，请检查后端服务是否就绪。');
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : '加载设置失败');
        setLoading(false);
      });
  }, []);

  // Fetch settings on mount
  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    fetchAllSettings()
      .then((data) => {
        if (cancelled) return;
        setProviderPresets(data.presets);
        setProviderConfigs(data.configs);
        setKeyStatuses(data.keys);
        setPrivacyConsent(data.privacy);
        setAIPrefs(data.ai);
        setConfirmationLog(data.log);
        if (data.allFailed) {
          setError('无法加载设置数据，请检查后端服务是否就绪。');
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载设置失败');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, []);

  return {
    activePage,
    setActivePage,
    providerPresets,
    providerConfigs,
    keyStatuses,
    privacyConsent,
    aiPrefs,
    confirmationLog,
    loading,
    error,
    refreshData,
  };
}
