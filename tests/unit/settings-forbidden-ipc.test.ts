/**
 * Phase 5-1-TD: Forbidden IPC Tests.
 *
 * Verifies that specific IPC channels are NEVER registered,
 * and that preload NEVER exposes dangerous capabilities.
 *
 * These tests use static analysis (grep-level) since channels
 * that are not registered will not respond to ipcMain.handle.
 * We verify by checking the source files directly.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

// ── Read source files for static analysis ──

const MAIN_SOURCES = [
  'electron/main.ts',
  'electron/ipc/settings.ipc.ts',
];
const PRELOAD_SOURCE = 'electron/preload.ts';

function readFileIfExists(relativePath: string): string | null {
  const abs = path.resolve(relativePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

function sourcesContain(pattern: RegExp): boolean {
  for (const src of MAIN_SOURCES) {
    const content = readFileIfExists(src);
    if (content && pattern.test(content)) return true;
  }
  return false;
}

function preloadContains(pattern: RegExp): boolean {
  const content = readFileIfExists(PRELOAD_SOURCE);
  if (!content) return false;
  return pattern.test(content);
}

// ═══════════════════════════════════════════════════════════════
// 5.2 Forbidden IPC — 15 forbidden channels
// ═══════════════════════════════════════════════════════════════

describe('Forbidden IPC channels', () => {
  const FORBIDDEN_CHANNELS = [
    'settings:get-api-key',
    'settings:read-secret',
    'settings:export-secrets',
    'settings:dump-config',
    'settings:validate-api-key',
    'settings:send-context',
    'settings:run-provider-request',
    'provider:invoke',
    'provider:send',
    'provider:stream',
    'context:send',
    'context:invoke',
    'ai:chat-start',
    'ai:chat-stream',
    'ai:chat-cancel',
  ];

  for (const channel of FORBIDDEN_CHANNELS) {
    it(`forbidden channel "${channel}" is NOT registered in any IPC source`, () => {
      // Search for the channel literal in source files
      const escaped = channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const found = sourcesContain(new RegExp(`['"]${escaped}['"]`));
      assert.equal(
        found,
        false,
        `Forbidden channel "${channel}" was found in IPC source files — it must NOT be registered.`,
      );
    });

    it(`forbidden channel "${channel}" is NOT exposed in preload`, () => {
      const escaped = channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const found = preloadContains(new RegExp(`['"]${escaped}['"]`));
      assert.equal(
        found,
        false,
        `Forbidden channel "${channel}" was found in preload — it must NOT be bridged to renderer.`,
      );
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// 5.2 Preload — 6 forbidden exposures
// ═══════════════════════════════════════════════════════════════

describe('Preload forbidden exposures', () => {
  it('preload does NOT expose ipcRenderer object', () => {
    const content = readFileIfExists(PRELOAD_SOURCE);
    assert.ok(content, 'preload.ts must exist');
    // Should not expose ipcRenderer directly
    assert.ok(
      !content!.includes('exposeInMainWorld(\'electronAPI\'') &&
      !content!.includes('exposeInMainWorld(\'ipc\'') &&
      !content!.includes('window.ipcRenderer') &&
      !content!.includes('window.electron'),
      'preload must not expose raw ipcRenderer',
    );
  });

  it('preload does NOT expose generic invoke method', () => {
    const content = readFileIfExists(PRELOAD_SOURCE);
    assert.ok(content);
    // No generic invoke pattern
    assert.ok(
      !content!.includes('invoke(') || content!.includes('ipcRenderer.invoke('),
      'preload should not have standalone generic invoke',
    );
  });

  it('preload does NOT expose getApiKey', () => {
    const found = preloadContains(/\bgetApiKey\b/);
    assert.equal(found, false, 'preload must not expose getApiKey');
  });

  it('preload does NOT expose readSecret', () => {
    const found = preloadContains(/\breadSecret\b/);
    assert.equal(found, false, 'preload must not expose readSecret');
  });

  it('preload does NOT expose provider runtime methods (send/stream/chat)', () => {
    const content = readFileIfExists(PRELOAD_SOURCE);
    assert.ok(content);
    // These should not appear as exposed API methods
    const forbiddenMethods = [
      /\bsend\b.*async/,
      /\bstream\b.*async/,
      /\bchat\b.*async/,
      /\brunProviderRequest\b/,
      /\bvalidateApiKey\b/,
      /\bdumpConfig\b/,
      /\bexportSecrets\b/,
    ];
    for (const pattern of forbiddenMethods) {
      assert.ok(
        !pattern.test(content!),
        `preload must not expose runtime method matching: ${pattern}`,
      );
    }
  });

  it('preload does NOT expose context send methods', () => {
    const content = readFileIfExists(PRELOAD_SOURCE);
    assert.ok(content);
    assert.ok(
      !content!.includes('context:send'),
      'preload must not expose context:send',
    );
    assert.ok(
      !content!.includes('context:invoke'),
      'preload must not expose context:invoke',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// 14 allowed channels are registered (whitelist verification)
// ═══════════════════════════════════════════════════════════════

describe('Allowed Settings IPC channels are registered', () => {
  const ALLOWED_CHANNELS = [
    'settings:get-provider-presets',
    'settings:get-provider-configs',
    'settings:set-provider-config',
    'settings:get-provider-models',
    'settings:get-api-key-status',
    'settings:set-api-key',
    'settings:clear-api-key',
    'settings:get-privacy-consent',
    'settings:set-privacy-consent',
    'settings:get-context-send-policy',
    'settings:set-context-send-policy',
    'settings:get-ai-preferences',
    'settings:set-ai-preferences',
    'settings:get-confirmation-log',
  ];

  for (const channel of ALLOWED_CHANNELS) {
    it(`allowed channel "${channel}" IS registered in contracts or IPC source`, () => {
      // Channel string literals are in settings.types.ts,
      // while settings.ipc.ts imports the constants
      const contractsContent = readFileIfExists('src/lib/contracts/settings.types.ts');
      const ipcContent = readFileIfExists('electron/ipc/settings.ipc.ts');
      assert.ok(contractsContent, 'settings.types.ts must exist');
      assert.ok(ipcContent, 'settings.ipc.ts must exist');
      // Search in contracts file for the string literal
      assert.ok(
        contractsContent!.includes(`'${channel}'`) || contractsContent!.includes(`"${channel}"`),
        `Allowed channel "${channel}" string literal not found in settings.types.ts`,
      );
    });
  }
});
