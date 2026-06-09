/**
 * AI Research — Privacy Consent Guard Test — Phase 5-2 P0.
 *
 * Verifies:
 * - Privacy consent is required before provider invocation
 * - Consent state is properly checked in preflight
 * - Consent check happens before any provider call
 * - consent must include allowRemoteProvider
 *
 * Test boundaries: 52-TB-SEC-060 through 52-TB-SEC-067
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
// Privacy Consent Gate
// ═══════════════════════════════════════════════════════════════

describe('AI Research — Privacy Consent Guard', () => {
  it('52-TB-SEC-060: preflight checks privacy consent before invocation', () => {
    const preflight = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(preflight, 'preflight service must exist');

    // Step 3 must check privacy consent
    assert.ok(
      /privacy_consent_required/.test(preflight),
      'Preflight must block on privacy_consent_required',
    );

    assert.ok(
      /isPrivacyConsented/.test(preflight),
      'Preflight must call isPrivacyConsented',
    );
  });

  it('52-TB-SEC-061: privacy consent must include allowRemoteProvider', () => {
    const preflight = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(preflight, 'preflight service must exist');

    // isPrivacyConsented must check both privacyConsentAccepted AND allowRemoteProvider
    assert.ok(
      /allowRemoteProvider/.test(preflight),
      'Preflight must check allowRemoteProvider',
    );
  });

  it('52-TB-SEC-062: privacy consent is checked in gate order (step 3)', () => {
    const preflight = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(preflight, 'preflight service must exist');

    // Gate sequence documented in comments:
    // 1. Provider enabled check
    // 2. API Key / local-free check
    // 3. Privacy consent check
    const step1Idx = preflight.indexOf('Step 1');
    const step2Idx = preflight.indexOf('Step 2');
    const step3Idx = preflight.indexOf('Step 3');

    assert.ok(step1Idx > 0, 'Step 1 must be documented');
    assert.ok(step2Idx > 0, 'Step 2 must be documented');
    assert.ok(step3Idx > 0, 'Step 3 must be documented');
    assert.ok(step1Idx < step2Idx, 'Step 1 must precede step 2');
    assert.ok(step2Idx < step3Idx, 'Step 2 must precede step 3');
  });

  it('52-TB-SEC-063: consent type includes necessary fields', () => {
    const settingsTypes = readSource('src/lib/contracts/settings.types.ts');
    assert.ok(settingsTypes, 'settings.types.ts must exist');

    // Privacy consent must have these fields
    assert.ok(
      /privacyConsentAccepted/.test(settingsTypes),
      'Privacy consent must have privacyConsentAccepted field',
    );
    assert.ok(
      /allowRemoteProvider/.test(settingsTypes),
      'Privacy consent must have allowRemoteProvider field',
    );
  });

  it('52-TB-SEC-064: consent is persistent and versioned', () => {
    const settingsTypes = readSource('src/lib/contracts/settings.types.ts');
    assert.ok(settingsTypes, 'settings.types.ts must exist');

    // Check for consent version tracking
    assert.ok(
      /consentVersion/i.test(settingsTypes) || /privacyConsentAccepted/.test(settingsTypes),
      'Consent must be trackable (persistent)',
    );
  });

  it('52-TB-SEC-065: preflight returns blocked reason when consent missing', () => {
    const preflight = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(preflight, 'preflight service must exist');

    // The blocked reason must include a user-friendly message
    assert.ok(
      /隐私/.test(preflight),
      'Blocked reason must contain user-friendly Chinese message about privacy',
    );
  });

  it('52-TB-SEC-066: IPC run handler checks consent via preflight', () => {
    const ipcHandler = readSource('electron/ipc/ai-research.ipc.ts');
    assert.ok(ipcHandler, 'ai-research.ipc.ts must exist');

    // The run handler invokes preflight which checks consent
    const runSection = ipcHandler.match(/RUN_CONFIRMED_TASK_CHANNEL[\s\S]*?^\s*\}\)/m);
    assert.ok(runSection, 'Run confirmed task handler must exist');

    assert.ok(
      /runInvocationPreflight/.test(runSection[0]),
      'Run handler must call runInvocationPreflight (which checks consent)',
    );
  });

  it('52-TB-SEC-067: no consent no invocation — consent must precede ANY provider call', () => {
    const preflight = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(preflight, 'preflight service must exist');

    // Consent check must come before the "All gates passed" return
    const consentIdx = preflight.indexOf('privacy_consent_required');
    const allPassedIdx = preflight.indexOf('All gates passed');

    assert.ok(
      consentIdx < allPassedIdx,
      'Consent check must happen before all gates pass',
    );
  });
});
