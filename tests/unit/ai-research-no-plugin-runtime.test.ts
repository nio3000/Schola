/**
 * AI Research — No Plugin Runtime Test — Phase 5-2 P0.
 *
 * Verifies:
 * - No plugin/extension runtime is present in AI Research
 * - No marketplace code exists
 * - No plugin:run or extension:invoke channels
 * - No plugin manager references in AI contracts
 * - Plugin page is placeholder only (Phase 5-2 scope)
 *
 * Test boundaries: 52-TB-SEC-120 through 52-TB-SEC-127
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
// No plugin runtime
// ═══════════════════════════════════════════════════════════════

describe('AI Research — No Plugin Runtime', () => {
  it('52-TB-SEC-120: plugin:run channel is NOT in AI Research contracts', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    assert.ok(
      !/plugin:run/.test(typesFile),
      'AI Research contracts must not contain plugin:run',
    );
    assert.ok(
      !/plugin:invoke/.test(typesFile),
      'AI Research contracts must not contain plugin:invoke',
    );
  });

  it('52-TB-SEC-121: no marketplace or extension catalog in AI contracts', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    assert.ok(
      !/marketplace/i.test(typesFile),
      'Must not contain marketplace',
    );
    assert.ok(
      !/extension.*catalog/i.test(typesFile),
      'Must not contain extension catalog',
    );
    assert.ok(
      !/plugin.*store/i.test(typesFile),
      'Must not contain plugin store',
    );
  });

  it('52-TB-SEC-122: AI Research IPC does not register plugin channels', () => {
    const ipcFile = readSource('electron/ipc/ai-research.ipc.ts');
    assert.ok(ipcFile, 'ai-research.ipc.ts must exist');

    assert.ok(
      !/plugin:/.test(ipcFile),
      'AI Research IPC must not register plugin channels',
    );
  });

  it('52-TB-SEC-123: no plugin manager import in AI services', () => {
    const services = [
      'electron/services/ai-research-context.service.ts',
      'electron/services/ai-research-preflight.service.ts',
      'electron/services/ai-research-task.service.ts',
      'electron/services/ai-provider-gateway.service.ts',
    ];

    for (const svc of services) {
      const content = readSource(svc);
      if (!content) continue;

      assert.ok(
        !/plugin.?manager/i.test(content),
        `${path.basename(svc)} must not import plugin manager`,
      );
      assert.ok(
        !/extension.?loader/i.test(content),
        `${path.basename(svc)} must not import extension loader`,
      );
    }
  });

  it('52-TB-SEC-124: settings plugin page is placeholder only', () => {
    const settingsTypes = readSource('src/lib/contracts/settings.types.ts');
    assert.ok(settingsTypes, 'settings.types.ts must exist');

    // Plugin page should be listed as '5-1-placeholder'
    const pluginPage = settingsTypes.match(/id:\s*['"]plugin['"][\s\S]*?phase:\s*['"]([^'"]+)['"]/);
    if (pluginPage) {
      assert.equal(
        pluginPage[1],
        '5-1-placeholder',
        'Plugin settings page must be placeholder',
      );
    }
  });

  it('52-TB-SEC-125: no plugin loading from AI Research workbench', () => {
    // Check if there are workbench-related files
    const featureDir = path.resolve('src/features/ai-research');
    if (fs.existsSync(featureDir)) {
      const files = fs.readdirSync(featureDir, { recursive: true });
      for (const file of files) {
        const filePath = path.join(featureDir, file.toString());
        if (fs.statSync(filePath).isFile() && /\.(ts|tsx)$/.test(file.toString())) {
          const content = fs.readFileSync(filePath, 'utf-8');
          assert.ok(
            !/loadPlugin/i.test(content) && !/activateExtension/i.test(content),
            `Workbench file ${file} must not load plugins`,
          );
        }
      }
    }
  });

  it('52-TB-SEC-126: no dynamic code execution patterns in AI Research', () => {
    const aiIpc = readSource('electron/ipc/ai-research.ipc.ts');
    assert.ok(aiIpc, 'ai-research.ipc.ts must exist');

    // Must not use eval, Function constructor, or vm module
    assert.ok(
      !/\beval\s*\(/.test(aiIpc),
      'AI Research IPC must not use eval',
    );
    assert.ok(
      !/\bnew Function\s*\(/.test(aiIpc),
      'AI Research IPC must not use Function constructor',
    );
    assert.ok(
      !/require\s*\(\s*['"]vm['"]/.test(aiIpc),
      'AI Research IPC must not use vm module',
    );
  });

  it('52-TB-SEC-127: no event-based plugin hook system for AI', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    // Must not have plugin hook interfaces
    assert.ok(
      !/PluginHook/i.test(typesFile),
      'Must not have PluginHook type',
    );
    assert.ok(
      !/onBeforeInvoke/i.test(typesFile),
      'Must not have onBeforeInvoke hooks',
    );
    assert.ok(
      !/onAfterTask/i.test(typesFile),
      'Must not have onAfterTask hooks',
    );
  });
});
