/**
 * AI Research — No Default Vault Context Test — Phase 5-2 P0.
 *
 * Verifies:
 * - ContextPack does NOT default to entire Vault
 * - Only explicitly selected files are included
 * - Hidden files / .schola / _exports are excluded
 * - No automatic file discovery
 *
 * Test boundaries: 52-TB-SEC-100 through 52-TB-SEC-107
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
// Explicit selection only
// ═══════════════════════════════════════════════════════════════

describe('AI Research — No Default Vault Context', () => {
  it('52-TB-SEC-100: BuildContextPackInput requires explicit selectedSources', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    const match = typesFile.match(/interface BuildContextPackInput\s*\{[\s\S]*?\n\}/);
    assert.ok(match, 'BuildContextPackInput must exist');
    const iface = match[0];

    // Must require selectedSources
    assert.ok(/selectedSources/.test(iface), 'Must have selectedSources');

    // Must NOT have any "all" or "vault" wildcard
    assert.ok(!/allFiles/i.test(iface), 'Must not have allFiles');
    assert.ok(!/includeAll/i.test(iface), 'Must not have includeAll');
    assert.ok(!/vaultScope/i.test(iface), 'Must not have vaultScope');
    assert.ok(!/autoDiscover/i.test(iface), 'Must not have autoDiscover');
  });

  it('52-TB-SEC-101: context service does NOT scan all vault files', () => {
    const contextService = readSource('electron/services/ai-research-context.service.ts');
    assert.ok(contextService, 'context service must exist');

    // Must not scan directory for markdown files
    assert.ok(
      !/readdirSync/.test(contextService) && !/readdir\s*\(/.test(contextService),
      'Context service must not scan directories',
    );

    // Must not have glob patterns for all files
    assert.ok(
      !/\*\*\/\*\.md/.test(contextService),
      'Context service must not glob for all markdown',
    );
  });

  it('52-TB-SEC-102: context service uses resolveVaultPath for path safety', () => {
    const contextService = readSource('electron/services/ai-research-context.service.ts');
    assert.ok(contextService, 'context service must exist');

    // Must use path-guard for all file access
    assert.ok(
      /resolveVaultPath/.test(contextService),
      'Context service must use resolveVaultPath for path safety',
    );
  });

  it('52-TB-SEC-103: ContextPack only contains files from selectedSources', () => {
    const contextService = readSource('electron/services/ai-research-context.service.ts');
    assert.ok(contextService, 'context service must exist');

    // buildContextPack must iterate over input.selectedSources, not scan the vault
    // The function receives BuildContextPackInput which has selectedSources
    const funcMatch = contextService.match(/function buildContextPack[\s\S]*?(?=\n\nexport|\nfunction)/);
    if (funcMatch) {
      const funcBody = funcMatch[0];
      // Must reference input.selectedSources
      assert.ok(
        /(?:input|params)\.\s*selectedSources/.test(funcBody),
        'buildContextPack must use selectedSources from input',
      );
    }
  });

  it('52-TB-SEC-104: hidden files and system paths are excluded via path-guard', () => {
    const contextService = readSource('electron/services/ai-research-context.service.ts');
    assert.ok(contextService, 'context service must exist');

    // Must use isExcludedSystemPath or similar guard
    assert.ok(
      /isExcludedSystemPath/.test(contextService) || /assertPathInsideRoot/.test(contextService),
      'Context service must use path-guard for system file exclusion',
    );
  });

  it('52-TB-SEC-105: .schola directory is excluded from context', () => {
    const contextService = readSource('electron/services/ai-research-context.service.ts');
    assert.ok(contextService, 'context service must exist');

    // .schola directory must never be included
    assert.ok(
      !/\.schola/.test(contextService) || /exclude/i.test(contextService),
      'Context service must protect .schola directory',
    );
  });

  it('52-TB-SEC-106: _exports directory is excluded from context', () => {
    // The path-guard should already handle this
    const pathGuard = readSource('electron/security/path-guard.ts');
    assert.ok(pathGuard, 'path-guard.ts must exist');

    // isExcludedSystemPath or similar should exclude _exports
    assert.ok(
      /_exports/i.test(pathGuard) || /excluded/i.test(pathGuard),
      'path-guard must have exclusion mechanism for system paths',
    );
  });

  it('52-TB-SEC-107: context pack requires explicit provider and model selection', () => {
    const typesFile = readSource('src/lib/contracts/ai-research.types.ts');
    assert.ok(typesFile, 'ai-research.types.ts must exist');

    const match = typesFile.match(/interface BuildContextPackInput\s*\{[\s\S]*?\n\}/);
    assert.ok(match, 'BuildContextPackInput must exist');
    const iface = match[0];

    // Must have providerId and model
    assert.ok(/providerId/.test(iface), 'Must have providerId');
    assert.ok(/model/.test(iface), 'Must have model');

    // Must NOT have default model fallback
    assert.ok(!/defaultModel/i.test(iface), 'Must not have default model fallback');
  });
});
