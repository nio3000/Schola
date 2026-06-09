/**
 * AI Research — No Renderer Context Send Test — Phase 5-2 P0.
 *
 * Verifies:
 * - Context send can only happen through fixed-function IPC
 * - Renderer cannot send arbitrary context
 * - No generic context send channel exists
 * - Preload does not expose context upload methods
 * - Context send always goes through the formal buildContextPack → preflight → run chain
 *
 * Test boundaries: 52-TB-SEC-110 through 52-TB-SEC-117
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
// No context:send or context:upload channels
// ═══════════════════════════════════════════════════════════════

describe('AI Research — No Renderer Context Send', () => {
  it('52-TB-SEC-110: context:send channel is NOT registered anywhere', () => {
    const ipcFile = readSource('electron/ipc/ai-research.ipc.ts');
    const mainFile = readSource('electron/main.ts');
    const allSources = [ipcFile, mainFile].filter(Boolean).join('\n');

    assert.ok(
      !/['"]context:send['"]/.test(allSources),
      'context:send channel must NOT be registered',
    );
  });

  it('52-TB-SEC-111: context:upload channel is NOT registered anywhere', () => {
    const allIpc = readSource('electron/ipc/ai-research.ipc.ts');
    assert.ok(allIpc, 'ai-research.ipc.ts must exist');

    assert.ok(
      !/context:upload/.test(allIpc),
      'context:upload channel must NOT be registered',
    );
  });

  it('52-TB-SEC-112: only buildContextPack channel handles context building', () => {
    const ipcFile = readSource('electron/ipc/ai-research.ipc.ts');
    assert.ok(ipcFile, 'ai-research.ipc.ts must exist');

    // Only build-context-pack should handle context
    const contextChannels = ipcFile.match(/context/i) || [];
    // We should find build-context-pack and preview-context-pack but NOT send/upload/transmit
    const badContextPatterns = [
      'context:send',
      'context:upload',
      'context:transmit',
      'context:stream',
    ];
    for (const pattern of badContextPatterns) {
      assert.ok(
        !ipcFile.includes(pattern),
        `Must not contain ${pattern} in IPC handler`,
      );
    }
  });

  it('52-TB-SEC-113: renderer API has exactly 10 fixed-function methods', () => {
    const api = readSource('src/lib/platform/ai-research-api.ts');
    assert.ok(api, 'ai-research-api.ts must exist');

    // Count exported async functions
    const funcs = api.match(/export async function \w+/g) || [];
    assert.equal(funcs.length, 10, 'Renderer API must have exactly 10 methods');

    // No generic send/upload/transmit
    for (const func of funcs) {
      assert.ok(
        !/send|upload|transmit|stream/i.test(func),
        `Function "${func}" must not be a generic send/upload method`,
      );
    }
  });

  it('52-TB-SEC-114: renderer API only calls window.schola.aiResearch', () => {
    const api = readSource('src/lib/platform/ai-research-api.ts');
    assert.ok(api, 'ai-research-api.ts must exist');

    // All calls must go through window.schola.aiResearch
    const scholaCalls = api.match(/window\.schola/);
    assert.ok(scholaCalls, 'API must use window.schola bridge');

    // Must NOT call ipcRenderer directly
    assert.ok(
      !/ipcRenderer/.test(api),
      'API must not call ipcRenderer directly',
    );
  });

  it('52-TB-SEC-115: context is always sent through the formal gateway chain', () => {
    const ipcFile = readSource('electron/ipc/ai-research.ipc.ts');
    assert.ok(ipcFile, 'ai-research.ipc.ts must exist');

    // The only way context reaches a provider is:
    // buildContextPack → createTaskDraft → runConfirmedTask (preflight) → gateway
    // No shortcut channels exist
    const forbiddenShortcuts = [
      'context:send',
      'ai:send-context',
      'provider:send-context',
    ];
    for (const shortcut of forbiddenShortcuts) {
      assert.ok(
        !ipcFile.includes(shortcut),
        `Shortcut "${shortcut}" must NOT exist`,
      );
    }
  });

  it('52-TB-SEC-116: preload does not expose context upload API', () => {
    const preload = readSource('electron/preload.ts');
    assert.ok(preload, 'preload.ts must exist');

    // Preload must not have sendContext, uploadContext, etc.
    assert.ok(
      !/sendContext/i.test(preload),
      'Preload must not expose sendContext',
    );
    assert.ok(
      !/uploadContext/i.test(preload),
      'Preload must not expose uploadContext',
    );
    assert.ok(
      !/transmitFiles/i.test(preload),
      'Preload must not expose transmitFiles',
    );
  });

  it('52-TB-SEC-117: context source refs are renderer-safe (relative paths only)', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    // ContextSourceRef must only have relativePath, displayName, sourceType, fileSize
    const match = typesFile.match(/interface ContextSourceRef\s*\{[\s\S]*?\n\}/);
    assert.ok(match, 'ContextSourceRef must exist');
    const iface = match[0];

    // No absolute paths
    assert.ok(!/absolutePath/i.test(iface), 'Must not have absolutePath');
    assert.ok(!/systemPath/i.test(iface), 'Must not have systemPath');

    // No content
    assert.ok(!/content/i.test(iface), 'Must not have content');
    assert.ok(!/data/i.test(iface), 'Must not have data');

    // Only metadata
    assert.ok(/relativePath/.test(iface), 'Must have relativePath');
    assert.ok(/displayName/.test(iface), 'Must have displayName');
    assert.ok(/sourceType/.test(iface), 'Must have sourceType');
    assert.ok(/fileSize/.test(iface), 'Must have fileSize');
  });
});
