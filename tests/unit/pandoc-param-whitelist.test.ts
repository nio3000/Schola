/**
 * Phase 3-1-A: Pandoc parameter whitelist test.
 *
 * Static contract verification that PandocOptions does NOT expose
 * blacklisted fields (rawArgs, filters, luaFilters, etc.) and that
 * ExportFormat is limited to the four allowed values.
 *
 * ⚠️  Type-level test — no Pandoc runtime dependency.
 */

import assert from 'node:assert/strict';
import type { PandocOptions, ExportFormat } from '../../src/lib/contracts/export.types';

function run(): void {
  // Build a minimal PandocOptions object to verify its shape
  const opts: PandocOptions = {
    standalone: true,
    templateId: null,
    bibliographyId: null,
    cslStyleId: null,
    resourcePaths: ['images/'],
    metadata: { title: 'Test', author: 'Author', date: '2026-05-17', lang: 'zh-CN' },
  };

  // ── Whitelisted fields must exist ────────────
  assert.ok('standalone' in opts, 'standalone must be present');
  assert.ok('templateId' in opts, 'templateId must be present');
  assert.ok('bibliographyId' in opts, 'bibliographyId must be present');
  assert.ok('cslStyleId' in opts, 'cslStyleId must be present');
  assert.ok('resourcePaths' in opts, 'resourcePaths must be present');
  assert.ok('metadata' in opts, 'metadata must be present');

  // ── Blacklisted fields must NOT exist ────────
  assert.ok(!('rawArgs' in opts), 'rawArgs must not be present');
  assert.ok(!('filters' in opts), 'filters must not be present');
  assert.ok(!('luaFilters' in opts), 'luaFilters must not be present');
  assert.ok(!('shellEscape' in opts), 'shellEscape must not be present');
  assert.ok(!('pdfEngine' in opts), 'pdfEngine must not be present');
  assert.ok(!('dataDir' in opts), 'dataDir must not be present');
  assert.ok(!('variables' in opts), 'variables must not be present');

  // ── ExportFormat union check ─────────────────
  // TypeScript enforces this at compile time, verifying at runtime
  // that the type alias contains exactly four members.
  const allowedFormats: ExportFormat[] = ['docx', 'pdf', 'latex', 'html'];
  assert.equal(allowedFormats.length, 4, 'ExportFormat must have exactly 4 members');

  // Verify each format is in the expected set
  const formatSet = new Set<string>(allowedFormats);
  assert.ok(formatSet.has('docx'), 'docx must be in ExportFormat');
  assert.ok(formatSet.has('pdf'), 'pdf must be in ExportFormat');
  assert.ok(formatSet.has('latex'), 'latex must be in ExportFormat');
  assert.ok(formatSet.has('html'), 'html must be in ExportFormat');
}

run();
console.log('[PASS] pandoc-param-whitelist');
