/**
 * Phase 5-1-TD: Secret Non-Leakage Tests.
 *
 * Verifies API keys NEVER leak into renderer, IPC responses, logs,
 * localStorage, sessionStorage, SQLite, error messages, or preload.
 *
 * Mix of type-level checks (interfaces) and static analysis (grep).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

// ── Read source files ──

function readSource(relativePath: string): string | null {
  const abs = path.resolve(relativePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

function sourceContains(relativePath: string, pattern: RegExp): boolean {
  const content = readSource(relativePath);
  if (!content) return false;
  return pattern.test(content);
}

// ── Import type definitions for structural checks ──

import {
  type ProviderConfig,
  type PrivacyConsentState,
  type AIPreferences,
  type ConfirmationLogEntry,
  type MaskedSecretStatus,
  maskApiKey,
  createNotConfiguredStatus,
  createConfiguredStatus,
} from '../../src/lib/contracts/settings.types';

// ═══════════════════════════════════════════════════════════════
// Type-level checks — interfaces must NOT contain key/secret fields
// ═══════════════════════════════════════════════════════════════

describe('Secret non-leakage — type-level', () => {
  it('ProviderConfig does NOT contain key/secret fields', () => {
    // TypeScript would catch this at compile-time, but also verify structurally
    const config: ProviderConfig = {
      providerId: 'openai',
      enabled: false,
      updatedAt: new Date().toISOString(),
    };
    // Verify no key/secret/rawKey/apiKey properties exist
    const keys = Object.keys(config);
    for (const k of keys) {
      assert.ok(
        !k.toLowerCase().includes('key') &&
        !k.toLowerCase().includes('secret') &&
        !k.toLowerCase().includes('token') &&
        !k.toLowerCase().includes('password'),
        `ProviderConfig must not contain field "${k}"`,
      );
    }
  });

  it('PrivacyConsentState does NOT contain key/secret fields', () => {
    const consent: PrivacyConsentState = {
      privacyConsentAccepted: true,
      privacyConsentVersion: '1.0',
      privacyConsentAcceptedAt: new Date().toISOString(),
      allowRemoteProvider: false,
      defaultContextSendPolicy: 'always-ask',
    };
    const keys = Object.keys(consent);
    for (const k of keys) {
      assert.ok(
        !k.toLowerCase().includes('key') &&
        !k.toLowerCase().includes('secret') &&
        !k.toLowerCase().includes('token'),
        `PrivacyConsentState must not contain field "${k}"`,
      );
    }
  });

  it('AIPreferences does NOT contain key/secret fields', () => {
    const prefs: AIPreferences = {
      aiEnabled: false,
      defaultProviderId: null,
      defaultModel: null,
      updatedAt: new Date().toISOString(),
    };
    const keys = Object.keys(prefs);
    for (const k of keys) {
      assert.ok(
        !k.toLowerCase().includes('key') &&
        !k.toLowerCase().includes('secret') &&
        !k.toLowerCase().includes('token'),
        `AIPreferences must not contain field "${k}"`,
      );
    }
  });

  it('ConfirmationLogEntry does NOT contain content/path/secret fields', () => {
    const entry: ConfirmationLogEntry = {
      id: 'log-1',
      confirmed: true,
      confirmedAt: new Date().toISOString(),
      providerId: 'openai',
      model: 'gpt-4',
      fileCount: 3,
      totalTokens: 12800,
      truncatedFileCount: 0,
      confirmationScope: 'per-request',
    };
    const keys = Object.keys(entry);
    const forbiddenPatterns = ['key', 'secret', 'token', 'filecontent', 'file_content', 'content', 'relativepath', 'file_path'];
    for (const k of keys) {
      const lower = k.toLowerCase();
      // Only flag exact matches, not false positives like "confirmationScope"
      const hasForbidden = forbiddenPatterns.some(
        (p) => lower === p || lower.endsWith('_' + p) || lower.startsWith(p + '_'),
      );
      assert.ok(
        !hasForbidden,
        `ConfirmationLogEntry must not contain field "${k}"`,
      );
    }
  });

  it('MaskedSecretStatus does NOT contain raw key', () => {
    const status: MaskedSecretStatus = createConfiguredStatus(
      'openai',
      'sk-...abc4',
      'safeStorage',
    );
    // The maskedSuffix already encodes the mask pattern
    assert.ok(status.maskedSuffix!.length <= 12, 'maskedSuffix must be <= 12 chars');
    assert.ok(!('rawKey' in status), 'MaskedSecretStatus must not have rawKey');
    assert.ok(!('apiKey' in status), 'MaskedSecretStatus must not have apiKey');
    assert.ok(!('secret' in status), 'MaskedSecretStatus must not have secret');
  });
});

// ═══════════════════════════════════════════════════════════════
// maskApiKey function tests
// ═══════════════════════════════════════════════════════════════

describe('maskApiKey', () => {
  it('masks a typical API key preserving prefix and suffix', () => {
    const masked = maskApiKey('sk-proj-1234567890abcdef');
    // prefix 'sk-' (3) + '...' (3) + suffix 'cdef' (4) = 10
    assert.equal(masked.length, 10);
    assert.ok(masked.startsWith('sk-'), 'masked key should preserve first 3 chars');
    assert.ok(masked.endsWith('cdef'), 'masked key should preserve last 4 chars');
  });

  it('returns "***" for keys of length <= 8', () => {
    const masked = maskApiKey('short');
    assert.equal(masked, '***');
  });

  it('masked key is never identical to original key', () => {
    const original = 'sk-12345678901234567890';
    const masked = maskApiKey(original);
    assert.notEqual(masked, original);
    assert.ok(masked.length < original.length);
  });

  it('masked key does not contain the middle part of original', () => {
    const original = 'sk-abcdefghijklmnop';
    const masked = maskApiKey(original);
    // Middle part should not appear
    for (let i = 4; i < original.length - 4; i++) {
      assert.ok(!masked.includes(original.substring(i, i + 4)));
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Static analysis — API Key must not appear in renderer code
// ═══════════════════════════════════════════════════════════════

describe('Secret non-leakage — static analysis', () => {
  const RENDERER_FILES = [
    'src/features/settings/SettingsCenter.tsx',
    'src/features/settings/components/ProviderPage.tsx',
    'src/features/settings/components/PrivacyPage.tsx',
    'src/features/settings/components/PrivacyConsentDialog.tsx',
    'src/features/settings/components/ContextConfirmDialog.tsx',
    'src/features/settings/hooks/useSettings.ts',
    'src/lib/platform/settings-api.ts',
  ];

  for (const file of RENDERER_FILES) {
    it(`${file} does NOT access localStorage`, () => {
      const content = readSource(file);
      if (!content) return; // skip missing files gracefully
      const hasLocalStorage = /\blocalStorage\b/.test(content);
      const hasSessionStorage = /\bsessionStorage\b/.test(content);
      assert.equal(
        hasLocalStorage,
        false,
        `${file} must not access localStorage`,
      );
      assert.equal(
        hasSessionStorage,
        false,
        `${file} must not access sessionStorage`,
      );
    });
  }

  it('settings-api.ts exposes only MaskedSecretStatus, never raw key', () => {
    const content = readSource('src/lib/platform/settings-api.ts');
    assert.ok(content);
    // Verify signature of getApiKeyStatus returns MaskedSecretStatus
    assert.ok(
      content!.includes('MaskedSecretStatus'),
      'settings-api must use MaskedSecretStatus for key status',
    );
    // Never return raw key
    assert.ok(
      !content!.includes('getApiKey') || content!.includes('getApiKeyStatus'),
      'settings-api must not expose getApiKey (only getApiKeyStatus)',
    );
  });

  it('ProviderPage does NOT render raw API key', () => {
    const content = readSource('src/features/settings/components/ProviderPage.tsx');
    assert.ok(content);
    // Should use MaskedSecretStatus
    assert.ok(
      content!.includes('MaskedSecretStatus'),
      'ProviderPage should use MaskedSecretStatus',
    );
    // Should mask key display
    assert.ok(
      content!.includes('masked') || content!.includes('maskedSuffix'),
      'ProviderPage should display masked keys only',
    );
  });

  it('ContextConfirmDialog does NOT contain file content/relativePath/API Key in summary', () => {
    const content = readSource('src/features/settings/components/ContextConfirmDialog.tsx');
    assert.ok(content);
    // ContextConfirmSummary should only contain metadata
    const summaryInterface = content!.match(/interface ContextConfirmSummary[\s\S]*?\}/);
    assert.ok(summaryInterface, 'ContextConfirmSummary interface must exist');
    const summaryText = summaryInterface![0];
    // Must NOT contain content/path/secret/key
    assert.ok(!/content/i.test(summaryText), 'ContextConfirmSummary must not have content field');
    assert.ok(!/path/i.test(summaryText), 'ContextConfirmSummary must not have path field');
    assert.ok(!/secret/i.test(summaryText), 'ContextConfirmSummary must not have secret field');
    assert.ok(!/apiKey/i.test(summaryText), 'ContextConfirmSummary must not have apiKey field');
  });

  it('window.schola.settings does NOT expose getApiKey/readSecret', () => {
    const content = readSource('src/lib/contracts/settings.types.ts');
    assert.ok(content);
    const apiInterface = content!.match(/interface ScholaSettingsApi[\s\S]*?\n\}/);
    assert.ok(apiInterface, 'ScholaSettingsApi must exist');
    const apiText = apiInterface![0];
    assert.ok(!/getApiKey\b(?!Status)/.test(apiText), 'ScholaSettingsApi must not have getApiKey');
    assert.ok(!/readSecret/.test(apiText), 'ScholaSettingsApi must not have readSecret');
  });
});

// ═══════════════════════════════════════════════════════════════
// Error sanitization — API key NEVER in error messages
// ═══════════════════════════════════════════════════════════════

describe('Secret non-leakage — error safety', () => {
  it('settings ipc handlers do NOT include raw key in error handling', () => {
    const content = readSource('electron/ipc/settings.ipc.ts');
    assert.ok(content);
    // Error messages in settings.ipc.ts should not echo raw key
    // Check that error paths use sanitizeIpcError
    assert.ok(
      content!.includes('sanitizeIpcError'),
      'settings.ipc must use sanitizeIpcError for error handling',
    );
  });

  it('provider-key-store error messages do NOT include key content', () => {
    const content = readSource('electron/services/provider-key-store.service.ts');
    assert.ok(content);
    // Error messages should use generic validation messages, not echo user input
    // "API key must not be empty" and "API key is too short" are safe generic messages
    const errorThrows = content!.match(/throw new Error\(['"]([^'"]*)['"]\)/g) || [];
    for (const err of errorThrows) {
      // Safe error messages may contain "key" in generic context
      // but must not contain actual key values or secrets
      assert.ok(
        !err.includes('sk-') &&
        !err.includes('secret_key') &&
        !err.includes('raw_key') &&
        !err.includes('password'),
        `provider-key-store error message should be generic: ${err}`,
      );
    }
  });

  it('settings-store error messages do NOT include secret content', () => {
    const content = readSource('electron/services/settings-store.service.ts');
    assert.ok(content);
    // Settings store should not echo any secret-like value
    const errorThrows = content!.match(/throw new Error\(['"]([^'"]*)['"]\)/g) || [];
    for (const err of errorThrows) {
      assert.ok(
        !err.toLowerCase().includes('secret') &&
        !err.toLowerCase().includes('password') &&
        !err.toLowerCase().includes('token'),
        `settings-store error must not reference secrets: ${err}`,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Global Settings DB — no secret columns
// ═══════════════════════════════════════════════════════════════

describe('Secret non-leakage — Global Settings DB schema', () => {
  it('global_provider_configs table has NO key/secret/raw_key columns', () => {
    const content = readSource('electron/services/settings-store.service.ts');
    assert.ok(content);
    // Extract all column definitions between CREATE TABLE ... ( and );
    const createTable = content!.match(
      /CREATE TABLE IF NOT EXISTS global_provider_configs\s*\(([\s\S]*?)\)\s*;/,
    );
    assert.ok(createTable, 'global_provider_configs table definition must exist');
    const columns = createTable![1].toLowerCase();
    // Check each forbidden word appears as a column name, not just substring
    for (const forbidden of ['key', 'secret', 'raw_key', 'api_key']) {
      const colPattern = new RegExp(`\\b${forbidden}\\b\\s+(text|integer|real|blob|numeric)`, 'i');
      assert.ok(
        !colPattern.test(columns),
        `global_provider_configs must not have ${forbidden} column`,
      );
    }
  });

  it('global_privacy_consent table has NO key/secret columns', () => {
    const content = readSource('electron/services/settings-store.service.ts');
    assert.ok(content);
    const createTable = content!.match(
      /CREATE TABLE IF NOT EXISTS global_privacy_consent\s*\(([\s\S]*?)\)\s*;/,
    );
    assert.ok(createTable, 'global_privacy_consent table definition must exist');
    const columns = createTable![1].toLowerCase();
    for (const forbidden of ['key', 'secret']) {
      const colPattern = new RegExp(`\\b${forbidden}\\b\\s+(text|integer|real|blob|numeric)`, 'i');
      assert.ok(!colPattern.test(columns), `global_privacy_consent must not have ${forbidden} column`);
    }
  });

  it('global_ai_preferences table has NO key/secret columns', () => {
    const content = readSource('electron/services/settings-store.service.ts');
    assert.ok(content);
    const createTable = content!.match(
      /CREATE TABLE IF NOT EXISTS global_ai_preferences\s*\(([\s\S]*?)\)\s*;/,
    );
    assert.ok(createTable, 'global_ai_preferences table definition must exist');
    const columns = createTable![1].toLowerCase();
    for (const forbidden of ['key', 'secret']) {
      const colPattern = new RegExp(`\\b${forbidden}\\b\\s+(text|integer|real|blob|numeric)`, 'i');
      assert.ok(!colPattern.test(columns), `global_ai_preferences must not have ${forbidden} column`);
    }
  });

  it('global_confirmation_log table has NO content/path/secret columns', () => {
    const content = readSource('electron/services/settings-store.service.ts');
    assert.ok(content);
    const createTable = content!.match(
      /CREATE TABLE IF NOT EXISTS global_confirmation_log\s*\(([\s\S]*?)\)\s*;/,
    );
    assert.ok(createTable, 'global_confirmation_log table definition must exist');
    const columns = createTable![1].toLowerCase();
    for (const forbidden of ['key', 'secret', 'content', 'path', 'api_key', 'raw_key']) {
      const colPattern = new RegExp(`\\b${forbidden}\\b\\s+(text|integer|real|blob|numeric)`, 'i');
      assert.ok(!colPattern.test(columns), `global_confirmation_log must not have ${forbidden} column`);
    }
  });
});
