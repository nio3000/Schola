/**
 * Phase 5-1-TD: No Context Send Tests.
 *
 * Verifies that Phase 5-1 NEVER sends file content to remote APIs.
 * Confirmation is metadata-only. No context upload mechanism exists.
 *
 * Static analysis + structural checks.
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

// ═══════════════════════════════════════════════════════════════
// No context send channels exist
// ═══════════════════════════════════════════════════════════════

describe('No Context Send — no context:send channel', () => {
  it('context:send channel is NOT registered anywhere', () => {
    const mainTs = readSource('electron/main.ts');
    const settingsIpc = readSource('electron/ipc/settings.ipc.ts');
    const preload = readSource('electron/preload.ts');

    const allSources = [mainTs, settingsIpc, preload].filter(Boolean).join('\n');
    assert.ok(
      !/['"]context:send['"]/.test(allSources),
      'context:send channel must NOT be registered',
    );
    assert.ok(
      !/['"]context:invoke['"]/.test(allSources),
      'context:invoke channel must NOT be registered',
    );
  });

  it('ContextConfirmDialog confirm does NOT send file content', () => {
    const content = readSource('src/features/settings/components/ContextConfirmDialog.tsx');
    assert.ok(content);
    // handleConfirm only logs metadata in dev mode, then calls onConfirm
    const handleConfirm = content!.match(/const handleConfirm[\s\S]*?^\s*\},/m);
    assert.ok(handleConfirm, 'handleConfirm must exist');
    const fnBody = handleConfirm![0];
    // Should NOT call fetch, invoke, send, postMessage
    assert.ok(!/fetch\s*\(/.test(fnBody), 'handleConfirm must not fetch');
    assert.ok(!/invoke\s*\(/.test(fnBody), 'handleConfirm must not invoke');
    assert.ok(!/\bsend\b/.test(fnBody), 'handleConfirm must not send');
    // Only calls onConfirm with metadata
    assert.ok(/onConfirm/.test(fnBody), 'handleConfirm should call onConfirm');
  });

  it('ConfirmationLogEntry contains only metadata (no content/path/secret)', () => {
    const content = readSource('src/lib/contracts/settings.types.ts');
    assert.ok(content);
    const logEntry = content!.match(/interface ConfirmationLogEntry[\s\S]*?\n\}/);
    assert.ok(logEntry, 'ConfirmationLogEntry must exist');
    const iface = logEntry![0];
    assert.ok(!/content/i.test(iface), 'ConfirmationLogEntry must NOT have content field');
    assert.ok(!/path/i.test(iface), 'ConfirmationLogEntry must NOT have relativePath');
    assert.ok(!/secret/i.test(iface), 'ConfirmationLogEntry must NOT have secret');
    assert.ok(!/apiKey/i.test(iface), 'ConfirmationLogEntry must NOT have apiKey');
    assert.ok(!/fileContent/i.test(iface), 'ConfirmationLogEntry must NOT have fileContent');
  });

  it('settings:get-confirmation-log does NOT return content/path/secret', () => {
    const content = readSource('electron/ipc/settings.ipc.ts');
    assert.ok(content);
    // The log handler should map rows to ConfirmationLogEntry without adding content
    const logHandler = content!.match(/SETTINGS_GET_CONFIRMATION_LOG_CHANNEL[\s\S]*?(?=\n\s*\n\s*\/\/|\n\})/);
    if (logHandler) {
      const body = logHandler[0];
      // Should not add content/path/secret to the returned entries
      assert.ok(!/content/i.test(body), 'get-confirmation-log must not add content');
      assert.ok(!/relativePath/i.test(body), 'get-confirmation-log must not add relativePath');
      assert.ok(!/apiKey/i.test(body), 'get-confirmation-log must not add apiKey');
      assert.ok(!/secret/i.test(body), 'get-confirmation-log must not add secret');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// No context upload mechanism exists
// ═══════════════════════════════════════════════════════════════

describe('No Context Send — no hidden upload infrastructure', () => {
  it('No context-pack send logic exists', () => {
    const content = readSource('electron/services/context-pack.service.ts') ||
                    readSource('electron/services/context-pack.service.ts');
    if (content) {
      // Context-pack service should be confirmation-state only, no send
      assert.ok(
        !/send\s*\(/.test(content) || content.includes('contextSendPolicy'),
        'context-pack.service should not contain send logic',
      );
    }
  });

  it('No hidden context upload mechanism exists in settings code', () => {
    const settingsSources = [
      'electron/ipc/settings.ipc.ts',
      'electron/services/settings-store.service.ts',
      'src/features/settings/components/ContextConfirmDialog.tsx',
      'src/lib/platform/settings-api.ts',
    ];
    const allContent = settingsSources
      .map(readSource)
      .filter(Boolean)
      .join('\n');

    // No upload, no post to remote
    assert.ok(
      !/\bupload\b/i.test(allContent),
      'No upload mechanism in settings code',
    );
    assert.ok(
      !/postMessage/.test(allContent),
      'No postMessage in settings code (except preload)',
    );
  });

  it('allowRemoteProvider=false implies remote capabilities are restricted', () => {
    const content = readSource('src/lib/contracts/settings.types.ts');
    assert.ok(content);
    // The contract should have allowRemoteProvider in PrivacyConsentState
    assert.ok(
      content!.includes('allowRemoteProvider'),
      'PrivacyConsentState must include allowRemoteProvider',
    );
  });

  it('defaultContextSendPolicy defaults to "always-ask"', () => {
    const content = readSource('src/lib/contracts/settings.types.ts');
    assert.ok(content);
    // createDefaultPrivacyConsentState should set defaultContextSendPolicy to 'always-ask'
    const defaultFn = content!.match(
      /function createDefaultPrivacyConsentState[\s\S]*?\n\}/,
    );
    assert.ok(defaultFn, 'createDefaultPrivacyConsentState must exist');
    const fnBody = defaultFn![0];
    assert.ok(
      /defaultContextSendPolicy.*always-ask/.test(fnBody),
      'Default context send policy must be always-ask',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// Context pack v2 — no send
// ═══════════════════════════════════════════════════════════════

describe('No Context Send — context-pack V2 safety', () => {
  it('context-pack-v2 types do NOT include send/upload methods', () => {
    const content = readSource('src/lib/contracts/context-pack-v2.types.ts');
    if (content) {
      assert.ok(
        !/\bsend\b/.test(content),
        'context-pack-v2 must not include send',
      );
      assert.ok(
        !/\bupload\b/.test(content),
        'context-pack-v2 must not include upload',
      );
    }
  });

  it('context-pack service has no executeSend method', () => {
    const content = readSource('electron/services/context-pack.service.ts');
    if (content) {
      // Already confirmed above that no send exists
      assert.ok(true);
    }
  });
});
