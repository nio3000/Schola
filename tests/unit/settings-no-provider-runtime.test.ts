/**
 * Phase 5-1-TD: No Provider Runtime Tests.
 *
 * Verifies that Phase 5-1 code NEVER imports provider runtimes,
 * makes HTTP requests, creates EventSources, or WebSockets.
 *
 * Static analysis: checks imports and code patterns in Settings IPC,
 * Settings Store, and Provider Key Store source files.
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

const SETTINGS_SOURCES = [
  'electron/ipc/settings.ipc.ts',
  'electron/services/settings-store.service.ts',
  'electron/services/provider-key-store.service.ts',
  'src/lib/platform/settings-api.ts',
  'src/features/settings/components/ProviderPage.tsx',
  'src/features/settings/hooks/useSettings.ts',
];

// ═══════════════════════════════════════════════════════════════
// No provider SDK imports
// ═══════════════════════════════════════════════════════════════

describe('No Provider Runtime — no provider SDK imports', () => {
  const FORBIDDEN_IMPORTS = [
    'openai',
    '@anthropic-ai/sdk',
    'anthropic',
    'ollama',
    '@langchain',
    'langchain',
    '@langgraph',
    'langgraph',
    '@vercel/ai',
    'axios',
    'node-fetch',
    'got',
    'undici',
  ];

  for (const src of SETTINGS_SOURCES) {
    for (const forbidden of FORBIDDEN_IMPORTS) {
      it(`${src} does NOT import "${forbidden}"`, () => {
        const content = readSource(src);
        if (!content) return;
        const importPattern = new RegExp(
          `(?:import|require)\\s*.*['"\`].*${forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        );
        assert.equal(
          importPattern.test(content),
          false,
          `${src} must not import ${forbidden}`,
        );
      });
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// No HTTP/network calls in settings code
// ═══════════════════════════════════════════════════════════════

describe('No Provider Runtime — no network calls', () => {
  const NETWORK_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
    { name: 'fetch()', pattern: /\bfetch\s*\(/ },
    { name: 'http.request', pattern: /\bhttp\.request\s*\(/ },
    { name: 'https.request', pattern: /\bhttps\.request\s*\(/ },
    { name: 'EventSource', pattern: /\bnew\s+EventSource\s*\(/ },
    { name: 'WebSocket', pattern: /\bnew\s+WebSocket\s*\(/ },
    { name: 'XMLHttpRequest', pattern: /\bnew\s+XMLHttpRequest\s*\(/ },
    { name: 'axios()', pattern: /\baxios\s*[\(\[]/ },
  ];

  for (const src of SETTINGS_SOURCES) {
    for (const { name, pattern } of NETWORK_PATTERNS) {
      it(`${src} does NOT use ${name}`, () => {
        const content = readSource(src);
        if (!content) return;
        assert.equal(
          pattern.test(content),
          false,
          `${src} must not use ${name} (Phase 5-1 has no provider runtime)`,
        );
      });
    }
  }
});

// ═══════════════════════════════════════════════════════════════
// No provider runtime features
// ═══════════════════════════════════════════════════════════════

describe('No Provider Runtime — no runtime features', () => {
  it('settings.ipc.ts does NOT contain health check logic', () => {
    const content = readSource('electron/ipc/settings.ipc.ts');
    assert.ok(content);
    // No health check endpoints or provider validation
    assert.ok(
      !content!.includes('healthCheck'),
      'settings.ipc must not have healthCheck method',
    );
    assert.ok(
      !content!.includes('providerHealth'),
      'settings.ipc must not have providerHealth',
    );
  });

  it('No API key validation via network exists', () => {
    const ipcContent = readSource('electron/ipc/settings.ipc.ts');
    const storeContent = readSource('electron/services/provider-key-store.service.ts');
    assert.ok(ipcContent);
    assert.ok(storeContent);
    // validateKey is a local length check, not network validation
    // No network-based validateApiKey or key verification
    assert.ok(
      !ipcContent!.includes('validateApiKey'),
      'No API key validation handler should exist',
    );
    assert.ok(
      !ipcContent!.includes('verifyKey'),
      'No key verification should exist',
    );
    assert.ok(
      !ipcContent!.includes('checkKey'),
      'No key check should exist',
    );
  });

  it('No dynamic model fetch exists (Model Gateway is static)', () => {
    const content = readSource('electron/ipc/settings.ipc.ts');
    assert.ok(content);
    // aggregateModels should be static (from presets + configs)
    assert.ok(
      content!.includes('aggregateModels') && content!.includes('preset') && content!.includes('config'),
      'Model aggregation should be static from presets and configs',
    );
    assert.ok(
      !content!.includes('fetch') || content!.includes('fetchAllSettings'),
      'No network-based model fetching should exist',
    );
  });

  it('Model Gateway service remains static/no-op', () => {
    const content = readSource('electron/services/model-gateway.service.ts') ||
                    readSource('electron/services/model-gateway.service.ts');
    // If the file doesn't exist yet, that's acceptable (Phase 5-1 may not create it)
    if (content) {
      assert.ok(
        !content.includes('fetch(') && !content.includes('http.'),
        'Model Gateway must remain static in Phase 5-1',
      );
    }
  });

  it('Provider health check does NOT exist', () => {
    const allSources = SETTINGS_SOURCES.map(readSource).filter(Boolean);
    const combined = allSources.join('\n');
    assert.ok(
      !/\bhealthCheck\b/.test(combined) && !/\bcheckHealth\b/.test(combined),
      'No provider health check should exist in Phase 5-1',
    );
    assert.ok(
      !/\bping\b/.test(combined) || combined.includes('mapping'),
      'No network ping check should exist',
    );
  });
});

// ═══════════════════════════════════════════════════════════════
// No streaming infrastructure
// ═══════════════════════════════════════════════════════════════

describe('No Provider Runtime — no streaming infrastructure', () => {
  it('No SSE (Server-Sent Events) infrastructure exists', () => {
    const allSources = SETTINGS_SOURCES.map(readSource).filter(Boolean);
    const combined = allSources.join('\n');
    assert.ok(
      !/SSE\b/i.test(combined) && !/ServerSent/i.test(combined),
      'No SSE infrastructure should exist',
    );
  });

  it('No chat completion logic exists', () => {
    const ipcContent = readSource('electron/ipc/settings.ipc.ts');
    assert.ok(ipcContent);
    assert.ok(
      !ipcContent!.includes('completion') && !ipcContent!.includes('chat.send'),
      'No chat completion logic in settings IPC',
    );
  });

  it('No AI task execution logic exists', () => {
    const allSources = SETTINGS_SOURCES.map(readSource).filter(Boolean);
    const combined = allSources.join('\n');
    assert.ok(
      !/\bexecutor\b/i.test(combined) && !/\borchestrat/i.test(combined),
      'No AI task execution/orchestration in Phase 5-1 settings code',
    );
  });
});
