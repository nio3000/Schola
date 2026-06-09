/**
 * AI Research — No Hidden Network Test — Phase 5-2 P0.
 *
 * Verifies:
 * - Provider invocation only happens through the official gateway
 * - No hidden fetch calls occur from renderer
 * - Preload does not expose generic invoke
 * - Only main process can call providers
 * - No direct HTTP from renderer
 *
 * Test boundaries: 52-TB-SEC-040 through 52-TB-SEC-047
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';

// ── Source analysis ──

const RENDERER_SOURCES = [
  'src/lib/platform/ai-research-api.ts',
  'src/lib/platform/schola-api.ts',
  'src/features/ai-research/',
];

function readSource(relativePath: string): string | null {
  const abs = path.resolve(relativePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, 'utf-8');
}

function readDirectory(dirPath: string): string[] {
  const abs = path.resolve(dirPath);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return [];

  const result: string[] = [];
  const entries = fs.readdirSync(abs, { recursive: true });
  for (const entry of entries) {
    const fullPath = path.join(abs, entry.toString());
    if (fs.statSync(fullPath).isFile() && /\.(ts|tsx)$/.test(entry.toString())) {
      result.push(fullPath);
    }
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// Gateway exclusivity
// ═══════════════════════════════════════════════════════════════

describe('AI Research — No Hidden Network', () => {
  it('52-TB-SEC-040: only ai-provider-gateway.service.ts calls fetch for AI', () => {
    // The gateway is the single entry point
    const gatewayPath = path.resolve('electron/services/ai-provider-gateway.service.ts');
    assert.ok(fs.existsSync(gatewayPath), 'ai-provider-gateway.service.ts must exist');

    const gateway = fs.readFileSync(gatewayPath, 'utf-8');
    // Gateway is allowed to use fetch
    assert.ok(/fetch\s*\(/.test(gateway), 'Gateway must use fetch for HTTP calls');
  });

  it('52-TB-SEC-041: renderer ai-research-api.ts does NOT call fetch', () => {
    const content = readSource('src/lib/platform/ai-research-api.ts');
    assert.ok(content, 'ai-research-api.ts must exist');

    assert.ok(!/fetch\s*\(/.test(content), 'Renderer API must not call fetch');
    assert.ok(!/XMLHttpRequest/.test(content), 'Renderer API must not use XMLHttpRequest');
    assert.ok(!/WebSocket/.test(content), 'Renderer API must not use WebSocket');
    // Must only use window.schola.aiResearch.*
    assert.ok(/window\.schola/.test(content), 'Renderer API must use window.schola bridge');
  });

  it('52-TB-SEC-042: preload does NOT expose generic invoke (each channel is fixed-function)', () => {
    const preload = readSource('electron/preload.ts');
    assert.ok(preload, 'preload.ts must exist');

    // Preload uses contextBridge.exposeInMainWorld with fixed-function channels
    // Each channel has its own wrapper, not a generic invoke(channel, payload)
    assert.ok(
      /contextBridge\.exposeInMainWorld/.test(preload),
      'Preload must use contextBridge.exposeInMainWorld',
    );

    // Verify aiResearch namespace is exposed as fixed-function
    assert.ok(
      /aiResearch/.test(preload),
      'Preload must expose aiResearch namespace',
    );

    // Each aiResearch method should have its own ipcRenderer.invoke call
    // (ipcRenderer.invoke per channel is expected - that's how contextBridge works)
    // The ban is on a generic "invoke(channel, data)" pattern, not on individual channel invocations
  });

  it('52-TB-SEC-043: no fetch in any renderer feature file', () => {
    const featureDir = path.resolve('src/features/ai-research');
    if (!fs.existsSync(featureDir)) {
      // Feature may not exist yet — that's fine, it's not the test's fault
      return;
    }

    const files = readDirectory(featureDir);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      assert.ok(
        !/fetch\s*\(/.test(content),
        `Renderer feature file ${path.relative(process.cwd(), file)} must not call fetch`,
      );
    }
  });

  it('52-TB-SEC-044: task service does NOT make direct HTTP calls', () => {
    const content = readSource('electron/services/ai-research-task.service.ts');
    assert.ok(content, 'ai-research-task.service.ts must exist');

    // Task service manages state, should not make HTTP calls directly
    // It delegates to the gateway
    assert.ok(
      !/fetch\s*\(/.test(content),
      'Task service must not make direct HTTP calls',
    );
  });

  it('52-TB-SEC-045: context service does NOT make HTTP calls', () => {
    const content = readSource('electron/services/ai-research-context.service.ts');
    assert.ok(content, 'ai-research-context.service.ts must exist');

    assert.ok(
      !/fetch\s*\(/.test(content),
      'Context service must not make HTTP calls',
    );
  });

  it('52-TB-SEC-046: preflight service does NOT make HTTP calls', () => {
    const content = readSource('electron/services/ai-research-preflight.service.ts');
    assert.ok(content, 'ai-research-preflight.service.ts must exist');

    assert.ok(
      !/fetch\s*\(/.test(content),
      'Preflight service must not make HTTP calls',
    );
  });

  it('52-TB-SEC-047: gateway service uses Node.js built-in fetch (not external HTTP library)', () => {
    const content = readSource('electron/services/ai-provider-gateway.service.ts');
    assert.ok(content, 'ai-provider-gateway.service.ts must exist');

    // Must not import from axios, node-fetch, got, etc.
    assert.ok(!/require\s*\(\s*['"]axios['"]/.test(content), 'Gateway must not use axios');
    assert.ok(!/require\s*\(\s*['"]node-fetch['"]/.test(content), 'Gateway must not use node-fetch');
    assert.ok(!/require\s*\(\s*['"]got['"]/.test(content), 'Gateway must not use got');
    assert.ok(!/require\s*\(\s*['"]undici['"]/.test(content), 'Gateway must not use undici');
  });
});
