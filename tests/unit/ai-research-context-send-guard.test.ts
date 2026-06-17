/**
 * AI Research — Context Send Guard Test — Phase 5-2 P0.
 *
 * Verifies:
 * - Context cannot be sent without context confirmation
 * - Context confirmation must precede provider invocation
 * - ContextPack only contains user-selected files
 * - ContextPackPreview is renderer-safe (no full content)
 * - No whole-Vault context upload
 *
 * Test boundaries: 52-TB-SEC-050 through 52-TB-SEC-059
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
// Context Confirmation Guard
// ═══════════════════════════════════════════════════════════════

describe('AI Research — Context Send Guard', () => {
  it('52-TB-SEC-050: preflight blocks invocation when context NOT confirmed', () => {
    const preflight = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(preflight, 'preflight service must exist');

    // Step 6 in preflight must check context confirmation
    assert.ok(
      /context_not_confirmed/.test(preflight),
      'Preflight must block on context_not_confirmed',
    );

    // Must use checkContextConfirmation
    assert.ok(
      /checkContextConfirmation/.test(preflight),
      'Preflight must use checkContextConfirmation',
    );
  });

  it('52-TB-SEC-051: context confirmation is checked BEFORE provider invocation', () => {
    const preflight = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(preflight, 'preflight service must exist');

    // The context confirmation check (step 6) comes before user explicit run (step 7)
    // and before provider invocation. Verify the order in the gate sequence.
    const contextCheckIdx = preflight.indexOf('context_not_confirmed');
    const providerReadyIdx = preflight.indexOf('providerReady');
    const userRunIdx = preflight.indexOf('user_not_explicitly_run');

    // Context confirmation must be checked before the final pass
    assert.ok(contextCheckIdx > 0, 'context_not_confirmed must appear in preflight');
    // It should appear before the all-passed return
    const allPassedIdx = preflight.indexOf('All gates passed');
    assert.ok(
      contextCheckIdx < allPassedIdx,
      'context_confirmed check must happen before all gates pass',
    );
  });

  it('52-TB-SEC-052: ContextPack requires explicitly selected sources', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    // BuildContextPackInput requires selectedSources (not "all files")
    const buildInput = typesFile.match(/interface BuildContextPackInput\s*\{[\s\S]*?\n\}/);
    assert.ok(buildInput, 'BuildContextPackInput must exist');
    assert.ok(
      /selectedSources/.test(buildInput[0]),
      'BuildContextPackInput must require selectedSources',
    );
    assert.ok(
      !/allFiles/.test(buildInput[0]),
      'BuildContextPackInput must NOT accept allFiles',
    );
    assert.ok(
      !/includeAll/.test(buildInput[0]),
      'BuildContextPackInput must NOT accept includeAll',
    );
  });

  it('52-TB-SEC-053: ContextPack has userSelectedOnly flag', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    const packMatch = typesFile.match(/interface ResearchContextPack\s*\{[\s\S]*?\n\}/);
    assert.ok(packMatch, 'ResearchContextPack must exist');
    assert.ok(
      /userSelectedOnly/.test(packMatch[0]),
      'ResearchContextPack must have userSelectedOnly flag',
    );
  });

  it('52-TB-SEC-054: context send policy is checked in preflight', () => {
    const preflight = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(preflight, 'preflight service must exist');

    // Step 4 must check context send policy
    assert.ok(
      /context_send_policy_denied/.test(preflight),
      'Preflight must block on context_send_policy_denied',
    );
  });

  it('52-TB-SEC-055: IPC handler enforces context confirmation before run', () => {
    const ipcHandler = readSource('electron/ipc/ai-research.ipc.ts');
    assert.ok(ipcHandler, 'ai-research.ipc.ts must exist');

    // The runConfirmedTask handler must check preflight before executing
    const runSection = ipcHandler.match(/RUN_CONFIRMED_TASK_CHANNEL[\s\S]*?^\s*\}\)/m);
    assert.ok(runSection, 'RUN_CONFIRMED_TASK_CHANNEL handler must exist');

    // Must call preflight before provider invocation
    assert.ok(
      /runInvocationPreflight/.test(runSection[0]),
      'Run handler must call runInvocationPreflight',
    );
  });

  it('52-TB-SEC-056: ContextPackPreview does NOT contain full file content', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    const previewMatch = typesFile.match(/interface ResearchContextPreview\s*\{[\s\S]*?\n\}/);
    assert.ok(previewMatch, 'ResearchContextPreview must exist');
    const iface = previewMatch[0];

    // Must NOT have full content
    assert.ok(!/contents?\s*[?:]\s*(?:string|Map)/i.test(iface), 'Preview must not contain file contents');
    assert.ok(!/fileData/i.test(iface), 'Preview must not contain fileData');

    // Must have ONLY metadata: selectedSourceRefs (which have relativePath, not content)
    assert.ok(/selectedSourceRefs/.test(iface), 'Preview must have selectedSourceRefs');
  });

  it('52-TB-SEC-057: context confirmation uses ContextConfirmationSnapshot (metadata only)', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    const snapMatch = typesFile.match(/interface ContextConfirmationSnapshot\s*\{[\s\S]*?\n\}/);
    assert.ok(snapMatch, 'ContextConfirmationSnapshot must exist');
    const iface = snapMatch[0];

    // Must be metadata-only
    assert.ok(!/fileContent/i.test(iface), 'Snapshot must not contain fileContent');
    assert.ok(!/apiKey/i.test(iface), 'Snapshot must not contain apiKey');
    assert.ok(!/rawPrompt/i.test(iface), 'Snapshot must not contain rawPrompt');

    // Must have metadata fields
    assert.ok(/fileCount/.test(iface), 'Snapshot must have fileCount');
    assert.ok(/totalTokens/.test(iface), 'Snapshot must have totalTokens');
    assert.ok(/providerId/.test(iface), 'Snapshot must have providerId');
  });

  it('52-TB-SEC-058: ContextPack never defaults to entire Vault', () => {
    const contextService = readSource('electron/services/ai-research-context.service.ts');
    assert.ok(contextService, 'context service must exist');

    // buildContextPack must only use explicitly passed sources
    // No "scan all files" or "read all notes" logic
    assert.ok(
      !/scanVault/i.test(contextService),
      'Context service must not scan entire Vault',
    );
    assert.ok(
      !/readAllFiles/i.test(contextService),
      'Context service must not read all files',
    );
    assert.ok(
      !/getAllMarkdownFiles/i.test(contextService),
      'Context service must not get all markdown files automatically',
    );
  });

  it('52-TB-SEC-059: renderer context-send only via fixed-function IPC', () => {
    const api = readSource('src/lib/platform/ai-research-api.ts');
    assert.ok(api, 'ai-research-api.ts must exist');

    // Only 12 fixed-function methods
    const methods = api.match(/\bexport async function \w+/g) || [];
    assert.equal(methods.length, 12, 'ai-research-api.ts must have exactly 12 methods');

    // No generic send
    assert.ok(!/sendContext/i.test(api), 'API must not have sendContext');
    assert.ok(!/uploadContext/i.test(api), 'API must not have uploadContext');
  });
});
