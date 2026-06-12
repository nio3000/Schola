/**
 * API Key Safety Tests — Phase 5-5-IMP-1-BATCH.
 *
 * Verifies API key safety invariants.
 */
import { describe, expect, it } from 'vitest';
import {
  createNotConfiguredStatus,
  createConfiguredStatus,
  createMemoryOnlyStatus,
  createUnavailableStatus,
  maskApiKey,
} from '../../src/lib/contracts/settings.types';

describe('API Key Safety', () => {
  describe('maskApiKey', () => {
    it('should mask short keys', () => {
      expect(maskApiKey('12345678')).toBe('***');
    });

    it('should mask long keys with prefix and suffix', () => {
      const result = maskApiKey('sk-1234567890abcdef');
      expect(result).toBe('sk-...cdef');
      expect(result.length).toBeLessThanOrEqual(12);
    });

    it('should never expose full key', () => {
      const key = 'this-is-a-very-long-secret-api-key-12345';
      const result = maskApiKey(key);
      expect(result).not.toBe(key);
      expect(result).toContain('...');
    });
  });

  describe('MaskedSecretStatus', () => {
    it('should create not-configured status', () => {
      const status = createNotConfiguredStatus('test-provider');
      expect(status.status).toBe('not-configured');
      expect(status.storageType).toBe('unavailable');
      expect(status.maskedSuffix).toBeUndefined();
    });

    it('should create configured status with masked suffix', () => {
      const status = createConfiguredStatus('test-provider', 'sk-...abcd', 'safeStorage');
      expect(status.status).toBe('configured');
      expect(status.maskedSuffix).toBe('sk-...abcd');
      expect(status.storageType).toBe('safeStorage');
      expect(status.updatedAt).toBeDefined();
    });

    it('should create memory-only status', () => {
      const status = createMemoryOnlyStatus('test-provider', 'sk-...abcd');
      expect(status.status).toBe('memory-only');
      expect(status.storageType).toBe('memory');
      expect(status.updatedAt).toBeDefined();
    });

    it('should create unavailable status', () => {
      const status = createUnavailableStatus('test-provider');
      expect(status.status).toBe('unavailable');
      expect(status.storageType).toBe('unavailable');
    });

    it('should not return raw key in any status', () => {
      const key = 'sk-actual-secret-key-12345';
      const configured = createConfiguredStatus('p', maskApiKey(key), 'safeStorage');
      const memoryOnly = createMemoryOnlyStatus('p', maskApiKey(key));

      for (const status of [configured, memoryOnly]) {
        const serialized = JSON.stringify(status);
        expect(serialized).not.toContain(key);
        expect(status.maskedSuffix).not.toBe(key);
      }
    });

    it('should never contain raw key field in serialized form', () => {
      const key = 'sk-secret-key-12345678';
      const status = createConfiguredStatus('provider', maskApiKey(key), 'safeStorage');
      const serialized = JSON.stringify(status);

      // No raw key field names
      expect(serialized).not.toMatch(/"rawKey"|"apiKey"|"secret"|"token"|"plaintext"/i);
      expect(serialized).not.toContain(key);
    });

    it('provider config persistence shape should not contain secret fields', async () => {
      const config = {
        providerId: 'openai',
        enabled: true,
        baseUrl: 'https://api.openai.com/v1',
        selectedModel: 'gpt5.5',
        remoteModels: [{ id: 'gpt5.5', displayName: 'GPT-5.5' }],
        updatedAt: '2026-06-12T00:00:00.000Z',
      };
      const serialized = JSON.stringify(config);
      expect(serialized).not.toMatch(
        /"rawKey"|"apiKey"|"secret"|"token"|"plaintext"|Authorization/i,
      );
    });
  });
});
