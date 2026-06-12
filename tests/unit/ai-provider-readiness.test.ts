/**
 * AI Provider Readiness Tests — Phase 5-5-IMP-1-BATCH.
 * Verifies readiness logic: cloud provider requires key, Ollama does not.
 */
import { describe, it, expect } from 'vitest';
import { PROVIDER_PRESETS, getProviderPreset } from '../../src/lib/contracts/provider-preset.types';
import type { MaskedSecretStatus } from '../../src/lib/contracts/settings.types';

function checkProviderReadiness(
  presetId: string,
  keyStatus: MaskedSecretStatus | undefined,
  enabled: boolean,
): { ready: boolean; blockedReason?: string } {
  const preset = getProviderPreset(presetId);
  if (!preset) return { ready: false, blockedReason: 'provider_not_found' };
  if (!enabled) return { ready: false, blockedReason: 'disabled' };

  if (preset.billingMode === 'local-free') {
    return { ready: true };
  }

  // Cloud provider needs API key
  const hasKey = keyStatus?.status === 'configured' || keyStatus?.status === 'memory-only';
  if (!hasKey) {
    return { ready: false, blockedReason: 'no_api_key' };
  }

  return { ready: true };
}

describe('AI Provider Readiness', () => {
  it('ollama is ready without API key', () => {
    const result = checkProviderReadiness('ollama', undefined, true);
    expect(result.ready).toBe(true);
  });

  it('ollama is ready even when enabled', () => {
    const result = checkProviderReadiness('ollama', undefined, true);
    expect(result.ready).toBe(true);
  });

  it('cloud provider is blocked without API key', () => {
    for (const preset of PROVIDER_PRESETS) {
      if (preset.billingMode !== 'byok') continue;
      if (preset.id === 'ollama') continue;

      const result = checkProviderReadiness(preset.id, undefined, true);
      expect(result.ready).toBe(false);
      expect(result.blockedReason).toBe('no_api_key');
    }
  });

  it('cloud provider is ready with configured key', () => {
    const keyStatus: MaskedSecretStatus = {
      providerId: 'openai',
      status: 'configured',
      maskedSuffix: 'sk-...abcd',
      storageType: 'safeStorage',
      updatedAt: new Date().toISOString(),
    };
    const result = checkProviderReadiness('openai', keyStatus, true);
    expect(result.ready).toBe(true);
  });

  it('cloud provider is ready with memory-only key', () => {
    const keyStatus: MaskedSecretStatus = {
      providerId: 'openai',
      status: 'memory-only',
      maskedSuffix: 'sk-...abcd',
      storageType: 'memory',
      updatedAt: new Date().toISOString(),
    };
    const result = checkProviderReadiness('openai', keyStatus, true);
    expect(result.ready).toBe(true);
  });

  it('disabled cloud provider is blocked even with key', () => {
    const keyStatus: MaskedSecretStatus = {
      providerId: 'openai',
      status: 'configured',
      maskedSuffix: 'sk-...abcd',
      storageType: 'safeStorage',
    };
    const result = checkProviderReadiness('openai', keyStatus, false);
    expect(result.ready).toBe(false);
    expect(result.blockedReason).toBe('disabled');
  });

  it('disabled ollama is blocked', () => {
    const result = checkProviderReadiness('ollama', undefined, false);
    expect(result.ready).toBe(false);
    expect(result.blockedReason).toBe('disabled');
  });

  it('not-configured key status blocks cloud provider', () => {
    const keyStatus: MaskedSecretStatus = {
      providerId: 'openai',
      status: 'not-configured',
      storageType: 'unavailable',
    };
    const result = checkProviderReadiness('openai', keyStatus, true);
    expect(result.ready).toBe(false);
    expect(result.blockedReason).toBe('no_api_key');
  });

  it('unavailable key status blocks cloud provider', () => {
    const keyStatus: MaskedSecretStatus = {
      providerId: 'openai',
      status: 'unavailable',
      storageType: 'unavailable',
    };
    const result = checkProviderReadiness('openai', keyStatus, true);
    expect(result.ready).toBe(false);
    expect(result.blockedReason).toBe('no_api_key');
  });

  it('domestic cloud provider is blocked without API key', () => {
    const result = checkProviderReadiness('moonshot', undefined, true);
    expect(result.ready).toBe(false);
    expect(result.blockedReason).toBe('no_api_key');
  });

  it('provider not found returns false', () => {
    const result = checkProviderReadiness('nonexistent', undefined, true);
    expect(result.ready).toBe(false);
  });
});
