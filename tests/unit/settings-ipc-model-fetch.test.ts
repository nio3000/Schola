import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SETTINGS_FETCH_PROVIDER_MODELS_CHANNEL,
  SETTINGS_TEST_PROVIDER_LATENCY_CHANNEL,
} from '../../src/lib/contracts/settings.types';

const ROOT = resolve(__dirname, '..', '..');

describe('settings IPC model fetch fixed functions', () => {
  it('declares fixed-function channel names', () => {
    expect(SETTINGS_FETCH_PROVIDER_MODELS_CHANNEL).toBe('settings:fetch-provider-models');
    expect(SETTINGS_TEST_PROVIDER_LATENCY_CHANNEL).toBe('settings:test-provider-latency');
  });

  it('registers handlers in settings IPC', () => {
    const source = readFileSync(resolve(ROOT, 'electron', 'ipc', 'settings.ipc.ts'), 'utf8');
    expect(source).toContain('SETTINGS_FETCH_PROVIDER_MODELS_CHANNEL');
    expect(source).toContain('SETTINGS_TEST_PROVIDER_LATENCY_CHANNEL');
    expect(source).toContain('fetchProviderModels');
    expect(source).toContain('testProviderLatency');
  });

  it('exposes named preload methods only', () => {
    const preload = readFileSync(resolve(ROOT, 'electron', 'preload.ts'), 'utf8');
    expect(preload).toContain('fetchProviderModels: (input: FetchProviderModelsInput)');
    expect(preload).toContain('testProviderLatency: (input: TestProviderLatencyInput)');
    expect(preload).not.toContain('settings.invoke');
    expect(preload).not.toContain('invokeSettings');
  });
});
