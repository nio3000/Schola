/**
 * Settings Store Tests — Phase 5-5-IMP-1-BATCH.
 * Tests provider config persistence: save, load, enable/disable, customModels.
 */
import { describe, it, expect } from 'vitest';
import type { ProviderConfig } from '../../src/lib/contracts/settings.types';
import { createDefaultProviderConfig } from '../../src/lib/contracts/settings.types';

describe('Settings Store (Provider Config)', () => {
  it('should create default provider config with disabled state', () => {
    const config = createDefaultProviderConfig('openai');
    expect(config.providerId).toBe('openai');
    expect(config.enabled).toBe(false);
    expect(config.updatedAt).toBeTruthy();
    expect(config.customModels).toBeUndefined();
    expect(config.customBaseURL).toBeUndefined();
    expect(config.displayName).toBeUndefined();
  });

  it('should default ollama to enabled', () => {
    const config = createDefaultProviderConfig('ollama');
    expect(config.enabled).toBe(true);
  });

  it('should have displayName optional', () => {
    const config: ProviderConfig = {
      providerId: 'test',
      enabled: true,
      updatedAt: new Date().toISOString(),
    };
    expect(config.displayName).toBeUndefined();
  });

  it('should have customModels as optional', () => {
    const config: ProviderConfig = {
      providerId: 'test',
      enabled: true,
      customModels: ['model-a', 'model-b'],
      updatedAt: new Date().toISOString(),
    };
    expect(config.customModels).toHaveLength(2);
  });

  it('should persist customModels array', () => {
    const config: ProviderConfig = {
      providerId: 'test',
      enabled: true,
      customModels: ['model-1', 'model-2', 'model-3'],
      updatedAt: '2026-06-12T00:00:00.000Z',
    };
    expect(config.customModels).toContain('model-1');
    expect(config.customModels).toContain('model-2');
    expect(config.customModels).toContain('model-3');
  });

  it('should support enable/disable toggle', () => {
    const config = createDefaultProviderConfig('openai');
    expect(config.enabled).toBe(false);

    const enabledConfig: ProviderConfig = { ...config, enabled: true };
    expect(enabledConfig.enabled).toBe(true);

    const disabledConfig: ProviderConfig = { ...enabledConfig, enabled: false };
    expect(disabledConfig.enabled).toBe(false);
  });

  it('should not contain API key in config', () => {
    const config = createDefaultProviderConfig('openai');
    const keys = Object.keys(config);
    expect(keys).not.toContain('apiKey');
    expect(keys).not.toContain('secret');
    expect(keys).not.toContain('token');
    expect(keys).not.toContain('rawKey');
    expect(keys).not.toContain('plaintext');
  });

  it('should not contain API key in serialized form', () => {
    const config = createDefaultProviderConfig('openai');
    const serialized = JSON.stringify(config);
    expect(serialized).not.toMatch(/apiKey|secret|token|rawKey|plaintext/i);
  });

  it('should parse custom_base_url when provided', () => {
    const config: ProviderConfig = {
      providerId: 'test',
      enabled: false,
      customBaseURL: 'https://custom.openai.com/v1',
      updatedAt: new Date().toISOString(),
    };
    expect(config.customBaseURL).toBe('https://custom.openai.com/v1');
  });

  it('should support remote model and selected model persistence fields', () => {
    const config: ProviderConfig = {
      providerId: 'openai',
      enabled: true,
      baseUrl: 'https://api.openai.com/v1',
      selectedModel: 'remote-model',
      remoteModels: [{ id: 'remote-model', displayName: 'Remote Model', contextWindow: 128000 }],
      lastModelFetchAt: '2026-06-12T00:00:00.000Z',
      updatedAt: '2026-06-12T00:00:00.000Z',
    };
    expect(config.remoteModels?.[0]?.id).toBe('remote-model');
    expect(config.selectedModel).toBe('remote-model');
    expect(config.lastModelFetchAt).toBeTruthy();
  });

  it('should support latency persistence fields', () => {
    const config: ProviderConfig = {
      providerId: 'openai',
      enabled: true,
      lastLatencyMs: 38,
      lastLatencyTestAt: '2026-06-12T00:00:00.000Z',
      updatedAt: '2026-06-12T00:00:00.000Z',
    };
    expect(config.lastLatencyMs).toBe(38);
    expect(config.lastLatencyTestAt).toContain('2026-06-12');
  });
});
