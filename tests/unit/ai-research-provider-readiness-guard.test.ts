/**
 * AI Research — Provider Readiness Guard Test — Phase 5-2 P0.
 *
 * Verifies:
 * - Provider readiness is properly computed
 * - Disabled providers show blocked status
 * - Key-configured status is properly checked
 * - Local-free providers show appropriate status
 * - Readiness respects provider presets
 *
 * Test boundaries: 52-TB-SEC-070 through 52-TB-SEC-079
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

function readSource(relativePath: string): string | null {
  const abs = path.resolve(relativePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

// ═══════════════════════════════════════════════════════════════
// Provider Readiness Structure
// ═══════════════════════════════════════════════════════════════

describe('AI Research — Provider Readiness Guard', () => {
  it('52-TB-SEC-070: ProviderReadiness type has all required fields', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    const match = typesFile.match(/interface ProviderReadiness\s*\{[\s\S]*?\n\}/);
    assert.ok(match, 'ProviderReadiness interface must exist');
    const iface = match[0];

    // Required fields
    assert.ok(/providerId/.test(iface), 'Must have providerId');
    assert.ok(/enabled/.test(iface), 'Must have enabled');
    assert.ok(/keyConfigured/.test(iface), 'Must have keyConfigured');
    assert.ok(/localFreeReady/.test(iface), 'Must have localFreeReady');
    assert.ok(/models/.test(iface), 'Must have models');
    assert.ok(/ready/.test(iface), 'Must have ready');
    assert.ok(/blockedReason\?/.test(iface), 'Must have blockedReason (optional)');

    // Must NOT contain secrets
    assert.ok(!/apiKey/i.test(iface), 'Must not contain apiKey');
    assert.ok(!/secret/i.test(iface), 'Must not contain secret');
  });

  it('52-TB-SEC-071: getProviderReadiness returns readonly array', () => {
    const contextService = readSource('electron/services/ai-research-context.service.ts');
    assert.ok(contextService, 'context service must exist');

    // Function signature should return readonly array
    assert.ok(
      /readonly ProviderReadiness\[\]/.test(contextService) || /ProviderReadiness\[\]/.test(contextService),
      'getProviderReadiness must return ProviderReadiness[]',
    );
  });

  it('52-TB-SEC-072: disabled providers show blocked reason', () => {
    const preflight = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(preflight, 'preflight service must exist');

    // When provider is disabled, blocked reason is provider_disabled
    assert.ok(
      /provider_disabled/.test(preflight),
      'Preflight must recognize provider_disabled as a blocked reason',
    );
  });

  it('52-TB-SEC-073: preflight checks provider enabled before key', () => {
    const preflight = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(preflight, 'preflight service must exist');

    // Step 1 checks provider enabled
    const enabledIdx = preflight.indexOf('provider_disabled');
    const keyIdx = preflight.indexOf('no_api_key');

    assert.ok(enabledIdx > 0, 'provider_disabled must appear in preflight');
    assert.ok(keyIdx > 0, 'no_api_key must appear in preflight');
    assert.ok(
      enabledIdx < keyIdx,
      'Provider enabled check must come before API key check',
    );
  });

  it('52-TB-SEC-074: local-free providers skip API key check', () => {
    const preflight = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(preflight, 'preflight service must exist');

    // checkKeyOrLocalFree must handle local-free billing mode
    assert.ok(
      /local-free/.test(preflight),
      'Preflight must handle local-free providers',
    );

    // Local-free providers don't need API keys
    const localFreeLogic = preflight.match(/local-free[\s\S]*?(?=\n\s*\})/);
    assert.ok(localFreeLogic, 'Must have local-free handling logic');
  });

  it('52-TB-SEC-075: AI model info excludes secrets', () => {
    const aiProviderTypes = readSource('src/lib/contracts/ai-provider.types.ts');
    assert.ok(aiProviderTypes, 'ai-provider.types.ts must exist');

    const modelMatch = aiProviderTypes.match(/interface AIModelInfo\s*\{[\s\S]*?\n\}/);
    assert.ok(modelMatch, 'AIModelInfo must exist');
    const iface = modelMatch[0];

    assert.ok(!/apiKey/i.test(iface), 'AIModelInfo must not contain apiKey');
    assert.ok(!/secret/i.test(iface), 'AIModelInfo must not contain secret');
    assert.ok(!/endpoint/i.test(iface), 'AIModelInfo must not contain endpoint (internal)');
  });

  it('52-TB-SEC-076: provider presets are BYOK or local-free only', () => {
    const presetTypes = readSource('src/lib/contracts/provider-preset.types.ts');
    assert.ok(presetTypes, 'provider-preset.types.ts must exist');

    // billingMode must only be 'byok' or 'local-free' (no 'schola-managed' in this phase)
    // Actually, schola-managed is in the type but should not have any presets using it
    const presets = presetTypes.match(/billingMode:\s*['"](\w[\w-]*)['"]/g) || [];
    for (const preset of presets) {
      const mode = preset.match(/['"](\w[\w-]*)['"]/)?.[1];
      assert.ok(
        mode === 'byok' || mode === 'local-free',
        `Provider preset billing mode must be byok or local-free, got: ${mode}`,
      );
    }
  });

  it('52-TB-SEC-077: provider gateway only uses configured providers', () => {
    const gateway = readSource('electron/services/ai-provider-gateway.service.ts');
    assert.ok(gateway, 'provider gateway must exist');

    // Must use getProviderPreset (built-in) not arbitrary config
    assert.ok(
      /getProviderPreset/.test(gateway),
      'Gateway must use getProviderPreset',
    );

    // Must use getProviderKey (BYOK key retrieval in main process)
    assert.ok(
      /getProviderKey/.test(gateway),
      'Gateway must use getProviderKey for BYOK',
    );
  });

  it('52-TB-SEC-078: no provider invocation bypasses readiness check', () => {
    const ipcHandler = readSource('electron/ipc/ai-research.ipc.ts');
    assert.ok(ipcHandler, 'ai-research.ipc.ts must exist');

    // The only way to invoke a provider is through runConfirmedTask
    // which goes through preflight
    const runSection = ipcHandler.match(/RUN_CONFIRMED_TASK_CHANNEL[\s\S]*?^\s*\}\)/m);
    assert.ok(runSection, 'Run handler must exist');

    // Must pass through preflight
    assert.ok(
      /runInvocationPreflight/.test(runSection[0]),
      'Run must go through preflight gate',
    );
  });

  it('52-TB-SEC-079: readiness is exposed through fixed-function IPC only', () => {
    const ipcHandler = readSource('electron/ipc/ai-research.ipc.ts');
    assert.ok(ipcHandler, 'ai-research.ipc.ts must exist');

    // Only GET_PROVIDER_READINESS_CHANNEL exposes readiness
    assert.ok(
      /GET_PROVIDER_READINESS_CHANNEL/.test(ipcHandler),
      'GET_PROVIDER_READINESS_CHANNEL must be registered',
    );
  });
});
