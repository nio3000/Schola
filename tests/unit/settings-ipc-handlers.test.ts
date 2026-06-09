/**
 * Settings IPC registration contract tests.
 *
 * Verifies registration only; does not invoke real Electron IPC or persistent settings services.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeAll, afterAll, vi } from 'vitest';
import { ipcMain } from 'electron';
import {
  SETTINGS_GET_PROVIDER_PRESETS_CHANNEL,
  SETTINGS_GET_PROVIDER_CONFIGS_CHANNEL,
  SETTINGS_SET_PROVIDER_CONFIG_CHANNEL,
  SETTINGS_GET_PROVIDER_MODELS_CHANNEL,
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
import { type ProviderPreset, PROVIDER_PRESETS } from '../../src/lib/contracts/provider-preset.types';
import { registerSettingsIpc } from '../../electron/ipc/settings.ipc';

type SettingsIpcHandler = (...args: readonly unknown[]) => unknown;

interface MockIpcMain {
  readonly _handlers: Map<string, SettingsIpcHandler>;
  handle(channel: string, handler: SettingsIpcHandler): void;
  eventNames(): string[];
}

vi.mock('electron', () => ({
  ipcMain: {
    _handlers: new Map<string, SettingsIpcHandler>(),
    handle(channel: string, handler: SettingsIpcHandler): void {
      this._handlers.set(channel, handler);
    },
    eventNames(): string[] {
      return Array.from(this._handlers.keys());
    },
  },
}));

vi.mock('../../electron/services/settings-store.service', () => ({
  getAllProviderConfigs: vi.fn(() => []),
  getProviderConfig: vi.fn(() => undefined),
  setProviderConfig: vi.fn((providerId: string) => ({
    providerId,
    enabled: false,
    updatedAt: '2026-06-05T00:00:00.000Z',
  })),
  getPrivacyConsent: vi.fn(() => ({
    privacyConsentAccepted: false,
    privacyConsentVersion: '',
    privacyConsentAcceptedAt: '',
    allowRemoteProvider: false,
    defaultContextSendPolicy: 'always-ask',
  })),
  setPrivacyConsent: vi.fn((consent: unknown) => consent),
  getContextSendPolicy: vi.fn(() => 'always-ask'),
  setContextSendPolicy: vi.fn((policy: string) => policy),
  getAIPreferences: vi.fn(() => ({
    aiEnabled: false,
    defaultProviderId: null,
    defaultModel: null,
    updatedAt: '2026-06-05T00:00:00.000Z',
  })),
  setAIPreferences: vi.fn(() => ({
    aiEnabled: false,
    defaultProviderId: null,
    defaultModel: null,
    updatedAt: '2026-06-05T00:00:00.000Z',
  })),
  getConfirmationLog: vi.fn(() => []),
}));

vi.mock('../../electron/services/provider-key-store.service', () => ({
  getProviderKeyStatus: vi.fn((providerId?: string) => {
    if (providerId) {
      return [{ providerId, status: 'not-configured' }];
    }
    return [];
  }),
  setProviderKey: vi.fn((providerId: string) => ({ providerId, status: 'configured' })),
  deleteProviderKey: vi.fn((providerId: string) => ({ providerId, status: 'not-configured' })),
}));

const expectedChannels = [
  SETTINGS_GET_PROVIDER_PRESETS_CHANNEL,
  SETTINGS_GET_PROVIDER_CONFIGS_CHANNEL,
  SETTINGS_SET_PROVIDER_CONFIG_CHANNEL,
  SETTINGS_GET_PROVIDER_MODELS_CHANNEL,
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
] as const;

function mockIpcMain(): MockIpcMain {
  return ipcMain as unknown as MockIpcMain;
}

function registeredChannels(): readonly string[] {
  return mockIpcMain().eventNames();
}

describe('registerSettingsIpc', () => {
  beforeAll(() => {
    mockIpcMain()._handlers.clear();
    registerSettingsIpc();
  });

  afterAll(() => {
    mockIpcMain()._handlers.clear();
  });

  it('registers exactly 14 channels', () => {
    const channels = registeredChannels();

    assert.equal(channels.length, 14);
    assert.deepEqual([...channels].sort(), [...expectedChannels].sort());
  });

  it('registers settings:get-provider-presets', () => {
    assert.ok(registeredChannels().includes(SETTINGS_GET_PROVIDER_PRESETS_CHANNEL));
  });

  it('registers settings:get-provider-configs', () => {
    assert.ok(registeredChannels().includes(SETTINGS_GET_PROVIDER_CONFIGS_CHANNEL));
  });

  it('registers settings:set-provider-config', () => {
    assert.ok(registeredChannels().includes(SETTINGS_SET_PROVIDER_CONFIG_CHANNEL));
  });

  it('registers settings:get-provider-models', () => {
    assert.ok(registeredChannels().includes(SETTINGS_GET_PROVIDER_MODELS_CHANNEL));
  });

  it('registers settings:get-api-key-status', () => {
    assert.ok(registeredChannels().includes(SETTINGS_GET_API_KEY_STATUS_CHANNEL));
  });

  it('registers settings:set-api-key', () => {
    assert.ok(registeredChannels().includes(SETTINGS_SET_API_KEY_CHANNEL));
  });

  it('registers settings:clear-api-key', () => {
    assert.ok(registeredChannels().includes(SETTINGS_CLEAR_API_KEY_CHANNEL));
  });

  it('registers settings:get-privacy-consent', () => {
    assert.ok(registeredChannels().includes(SETTINGS_GET_PRIVACY_CONSENT_CHANNEL));
  });

  it('registers settings:set-privacy-consent', () => {
    assert.ok(registeredChannels().includes(SETTINGS_SET_PRIVACY_CONSENT_CHANNEL));
  });

  it('registers settings:get-context-send-policy', () => {
    assert.ok(registeredChannels().includes(SETTINGS_GET_CONTEXT_SEND_POLICY_CHANNEL));
  });

  it('registers settings:set-context-send-policy', () => {
    assert.ok(registeredChannels().includes(SETTINGS_SET_CONTEXT_SEND_POLICY_CHANNEL));
  });

  it('registers settings:get-ai-preferences', () => {
    assert.ok(registeredChannels().includes(SETTINGS_GET_AI_PREFERENCES_CHANNEL));
  });

  it('registers settings:set-ai-preferences', () => {
    assert.ok(registeredChannels().includes(SETTINGS_SET_AI_PREFERENCES_CHANNEL));
  });

  it('registers settings:get-confirmation-log', () => {
    assert.ok(registeredChannels().includes(SETTINGS_GET_CONFIRMATION_LOG_CHANNEL));
  });

  it('get-provider-presets handler returns ProviderPreset array', () => {
    const handler = mockIpcMain()._handlers.get(SETTINGS_GET_PROVIDER_PRESETS_CHANNEL);

    assert.equal(typeof handler, 'function');
    if (typeof handler !== 'function') throw new Error('settings:get-provider-presets handler missing');

    const presets = handler() as readonly ProviderPreset[];

    assert.ok(Array.isArray(presets));
    assert.deepEqual(presets, PROVIDER_PRESETS);
    assert.ok(presets.length > 0);

    for (const preset of presets) {
      assert.equal(typeof preset.id, 'string');
      assert.equal(typeof preset.kind, 'string');
      assert.equal(typeof preset.displayName, 'string');
      assert.equal(typeof preset.protocol, 'string');
      assert.equal(typeof preset.baseURL, 'string');
      assert.equal(typeof preset.defaultModel, 'string');
      assert.equal(typeof preset.authType, 'string');
      assert.equal(typeof preset.authHeader, 'string');
      assert.equal(typeof preset.billingMode, 'string');
      assert.ok(Array.isArray(preset.capabilities));
      assert.equal(typeof preset.description, 'string');
    }
  });
});
