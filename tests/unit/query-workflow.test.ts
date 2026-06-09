/**
 * QueryWorkflow Tests — Phase 4-2-E.
 * Test boundaries: 42-TB-150 through 42-TB-156
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { QueryWorkflow } from '../../electron/services/query-workflow.service';
import type { QueryWorkflowRequest } from '../../src/lib/contracts/workflow.types';

describe('QueryWorkflow', () => {
  it('requires Context Confirmation', async () => {
    const wf = new QueryWorkflow();
    const req: QueryWorkflowRequest = { query: 'test', confirmContext: false };
    const result = await wf.execute(req);
    assert.equal(result.status, 'failed');
    assert.ok(result.errors.some((e) => e.code === 'CONTEXT_NOT_CONFIRMED'));
  });

  it('42-TB-150: returns answer with sources', async () => {
    const wf = new QueryWorkflow();
    const contents = new Map([
      ['notes/a.md', '# Methods\nStandard procedures for synthesis.'],
    ]);
    const req: QueryWorkflowRequest = { query: 'synthesis methods', confirmContext: true };
    const result = await wf.execute(req, contents);
    assert.equal(result.status, 'completed');
    assert.ok(result.isMockAnswer);
  });

  it('42-TB-152: no source in empty index → insufficient evidence', async () => {
    const wf = new QueryWorkflow();
    const req: QueryWorkflowRequest = { query: 'anything', confirmContext: true };
    const result = await wf.execute(req);
    assert.equal(result.hasSufficientEvidence, false);
    assert.equal(result.sources.length, 0);
  });

  it('42-TB-156: sources use relativePath', async () => {
    const wf = new QueryWorkflow();
    const contents = new Map([
      ['notes/a.md', '# Test\nContent for testing.'],
    ]);
    const req: QueryWorkflowRequest = { query: 'testing', confirmContext: true };
    const result = await wf.execute(req, contents);
    for (const s of result.sources) {
      assert.ok(!s.relativePath.includes(':\\'));
      assert.ok(!s.relativePath.includes('\\\\'));
    }
  });

  it('elapsed time is tracked', async () => {
    const wf = new QueryWorkflow();
    const req: QueryWorkflowRequest = { query: 'test', confirmContext: true };
    const result = await wf.execute(req);
    assert.ok(result.elapsedMs >= 0);
  });

  it('isMockAnswer is always true', async () => {
    const wf = new QueryWorkflow();
    const req: QueryWorkflowRequest = { query: 'test', confirmContext: true };
    const result = await wf.execute(req);
    assert.ok(result.isMockAnswer);
  });
});

describe('query safety', () => {
  it('no real provider call', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/query-workflow.service.ts'),
      'utf8',
    );
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
  });

  it('no Vault write', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/query-workflow.service.ts'),
      'utf8',
    );
    assert.ok(!content.includes('writeFile'));
    assert.ok(!content.includes('saveToVault'));
  });

  it('no external database claim', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/query-workflow.service.ts'),
      'utf8',
    );
    assert.ok(!content.includes('PubMed'));
    assert.ok(!content.includes('Crossref'));
  });
});
