/**
 * LintWorkflow Tests — Phase 4-2-E.
 * Test boundaries: 42-TB-160 through 42-TB-163
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { LintWorkflow } from '../../electron/services/lint-workflow.service';
import type { LintRequest } from '../../src/lib/contracts/workflow.types';
import { ALL_LINT_RULES, isValidLintRule } from '../../src/lib/contracts/workflow.types';

describe('LintWorkflow', () => {
  it('42-TB-160: detects broken_links', async () => {
    const wf = new LintWorkflow();
    const contents = new Map([
      ['notes/a.md', '# A\nSee [[nonexistent]].'],
      ['notes/b.md', '# B\nAlso [[missing-page]].'],
    ]);
    const req: LintRequest = { rules: ['broken_links'] };
    const result = await wf.execute(req, contents);
    assert.ok(result.totalFindings > 0);
    assert.ok(result.findings.some((f) => f.rule === 'broken_links'));
  });

  it('42-TB-161: detects missing_metadata', async () => {
    const wf = new LintWorkflow();
    const contents = new Map([
      ['notes/a.md', '# No frontmatter\nJust content.'],
    ]);
    const req: LintRequest = { rules: ['missing_metadata'] };
    const result = await wf.execute(req, contents);
    assert.ok(result.totalFindings > 0);
    assert.ok(result.findings.some((f) => f.rule === 'missing_metadata'));
  });

  it('no frontmatter warning when missing', async () => {
    const wf = new LintWorkflow();
    const contents = new Map([['notes/a.md', '# No metadata at all']]);
    const req: LintRequest = { rules: ['missing_metadata'] };
    const result = await wf.execute(req, contents);
    const fmFindings = result.findings.filter((f) => f.rule === 'missing_metadata');
    assert.ok(fmFindings.length > 0);
  });

  it('detects orphan_notes', async () => {
    const wf = new LintWorkflow();
    const contents = new Map([
      ['notes/a.md', '# A\nThis links to [[b]].'],
      ['notes/b.md', '# B\nNo links here.'],
      ['notes/c.md', '# C\nIsolated note.'],
    ]);
    const req: LintRequest = { rules: ['orphan_notes'] };
    const result = await wf.execute(req, contents);
    const orphanFindings = result.findings.filter((f) => f.rule === 'orphan_notes');
    // 'c' should be orphan (no incoming link)
    assert.ok(orphanFindings.some((f) => f.relativePath === 'notes/c.md'));
  });

  it('42-TB-163: lint does not modify files (report only)', async () => {
    const wf = new LintWorkflow();
    const original = '# A\nSee [[broken]].';
    const contents = new Map([['notes/a.md', original]]);
    const req: LintRequest = { rules: ['broken_links'] };
    await wf.execute(req, contents);
    // Content should be unchanged
    assert.equal(contents.get('notes/a.md'), original);
  });

  it('all lint rules are recognized', () => {
    for (const rule of ALL_LINT_RULES) {
      assert.ok(isValidLintRule(rule));
    }
    assert.equal(isValidLintRule('invalid'), false);
  });

  it('handles empty file set', async () => {
    const wf = new LintWorkflow();
    const req: LintRequest = { rules: ['broken_links'] };
    const result = await wf.execute(req);
    assert.equal(result.totalFiles, 0);
    assert.equal(result.totalFindings, 0);
  });

  it('finds no broken links when all wikilinks resolve', async () => {
    const wf = new LintWorkflow();
    const contents = new Map([
      ['notes/a.md', '# A\nSee [[b]].'],
      ['notes/b.md', '# B\nContent.'],
    ]);
    const req: LintRequest = { rules: ['broken_links'] };
    const result = await wf.execute(req, contents);
    assert.equal(result.findings.filter((f) => f.rule === 'broken_links').length, 0);
  });
});

describe('lint safety', () => {
  it('no file modification', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/lint-workflow.service.ts'),
      'utf8',
    );
    assert.ok(!content.includes('writeFile'));
    assert.ok(!content.includes('saveToVault'));
    assert.ok(!content.includes('fs.write'));
  });

  it('no real provider call', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/lint-workflow.service.ts'),
      'utf8',
    );
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
  });

  it('relativePath-only in findings', async () => {
    const wf = new LintWorkflow();
    const contents = new Map([['notes/a.md', '# A\nSee [[broken]].']]);
    const result = await wf.execute({ rules: ['broken_links'] }, contents);
    for (const f of result.findings) {
      assert.ok(!f.relativePath.includes(':\\'));
      assert.ok(!f.relativePath.includes('\\\\'));
    }
  });
});
