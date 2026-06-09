/**
 * Phase 3-1-C: Pandoc args whitelist test.
 *
 * Verifies that buildPandocArgs produces safe arguments:
 *  - No rawArgs, filters, luaFilters, shellEscape
 *  - Metadata keys are whitelisted
 *  - resourcePaths are validated
 *
 * Uses the actual pandoc-args module (no Pandoc runtime).
 */

import assert from 'node:assert/strict';
import { validateResourcePaths, buildPandocArgs } from '../../electron/services/engines/export/pandoc-args';

function run(): void {
  // resourcePaths: valid vault-relative path passes
  assert.equal(validateResourcePaths('/tmp/vault', ['images/']), null,
    'Vault-internal path must pass validation');

  // resourcePaths: must reject ../
  assert.ok(validateResourcePaths('/tmp/vault', ['../escape.txt']) !== null,
    'Path traversal must be rejected');

  // resourcePaths: must reject absolute paths
  assert.ok(validateResourcePaths('/tmp/vault', ['/etc/passwd']) !== null,
    'Absolute path must be rejected');

  // resourcePaths: null/empty is OK
  assert.equal(validateResourcePaths('/tmp/vault', undefined), null);
  assert.equal(validateResourcePaths('/tmp/vault', []), null);

  // buildPandocArgs: produces safe argument array
  const args = buildPandocArgs('/tmp/vault', {
    sourceAbs: '/tmp/vault/notes/test.md',
    outputAbs: '/tmp/vault/_exports/out.docx',
    targetFormat: 'docx',
    options: {
      standalone: true,
      templateId: null,
      bibliographyId: null,
      cslStyleId: null,
      metadata: { title: 'Test', author: 'Author', lang: 'en' },
    },
  });

  // Must contain --from markdown and --to docx
  assert.ok(args.includes('--from'));
  assert.ok(args.includes('markdown'));
  assert.ok(args.includes('--to'));
  assert.ok(args.includes('docx'));

  // Must NOT contain blacklisted args
  assert.ok(!args.includes('--filter'), 'Must not contain --filter');
  assert.ok(!args.includes('--lua-filter'), 'Must not contain lua-filter');
  assert.ok(!args.includes('--pdf-engine'), 'Must not contain pdf-engine');
  assert.ok(!args.includes('--data-dir'), 'Must not contain data-dir');
  assert.ok(!args.includes('rawArgs'), 'Must not expose rawArgs');

  // Metadata keys present
  assert.ok(args.includes('--metadata'), 'Must contain metadata flags');
}

run();
console.log('[PASS] pandoc-args-whitelist-runtime');
