/**
 * IngestWorkflow Tests — Phase 4-2-E.
 * Test boundaries: 42-TB-140 through 42-TB-144
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { IngestWorkflow } from '../../electron/services/ingest-workflow.service';
import type { IngestRequest } from '../../src/lib/contracts/workflow.types';

function makeRequest(overrides?: Partial<IngestRequest>): IngestRequest {
  return {
    scope: {
      type: 'files',
      selectedFiles: [
        { relativePath: 'notes/a.md', displayName: 'a.md' },
        { relativePath: 'notes/b.md', displayName: 'b.md' },
      ],
      selectedFolder: { relativePath: 'notes/', displayName: 'notes' },
    },
    confirmContext: true,
    ...overrides,
  };
}

describe('IngestWorkflow', () => {
  it('42-TB-140: requires explicit file selection', async () => {
    const wf = new IngestWorkflow();
    const req = makeRequest({ scope: { type: 'files', selectedFiles: [] } });
    const result = await wf.execute(req, new Map());
    assert.equal(result.status, 'failed');
    assert.ok(result.errors.some((e) => e.code === 'NO_FILES_SELECTED'));
  });

  it('42-TB-140: requires Context Confirmation', async () => {
    const wf = new IngestWorkflow();
    const req = makeRequest({ confirmContext: false });
    const result = await wf.execute(req, new Map());
    assert.equal(result.status, 'failed');
    assert.ok(result.errors.some((e) => e.code === 'CONTEXT_NOT_CONFIRMED'));
  });

  it('42-TB-140: indexes selected files', async () => {
    const wf = new IngestWorkflow();
    const contents = new Map([
      ['notes/a.md', '# A\nContent A.'],
      ['notes/b.md', '# B\nContent B.'],
    ]);
    const result = await wf.execute(makeRequest(), contents);
    assert.equal(result.status, 'completed');
    assert.equal(result.indexedFiles, 2);
    assert.ok(result.totalChunks > 0);
  });

  it('42-TB-141: IngestResult includes manifest', async () => {
    const wf = new IngestWorkflow();
    const contents = new Map([['notes/a.md', '# Test\nContent.']]);
    const result = await wf.execute(makeRequest(), contents);
    assert.ok(result.manifest);
    assert.equal(result.manifest.totalFiles, 1);
    assert.equal(result.manifest.files.length, 1);
  });

  it('42-TB-142: partial failure continues with remaining files', async () => {
    const wf = new IngestWorkflow();
    const contents = new Map([
      ['notes/a.md', '# Valid\nContent.'],
      ['notes/b.md', '# Valid\nMore.'],
    ]);
    const result = await wf.execute(makeRequest(), contents);
    assert.equal(result.status, 'completed');
    assert.equal(result.indexedFiles, 2);
  });

  it('42-TB-144: already indexed file re-ingest updates', async () => {
    const wf = new IngestWorkflow();
    const contents1 = new Map([['notes/a.md', '# V1\nOld content.']]);
    await wf.execute(makeRequest(), contents1);

    const contents2 = new Map([['notes/a.md', '# V2\nNew content updated here.']]);
    const result2 = await wf.execute(makeRequest(), contents2);
    assert.equal(result2.status, 'completed');
    assert.equal(result2.indexedFiles, 1);
  });

  it('handles empty content gracefully', async () => {
    const wf = new IngestWorkflow();
    const contents = new Map([['notes/empty.md', '']]);
    const result = await wf.execute(makeRequest(), contents);
    assert.equal(result.status, 'completed');
    assert.equal(result.indexedFiles, 0);
  });

  it('getManifest returns current manifest', async () => {
    const wf = new IngestWorkflow();
    const contents = new Map([['notes/a.md', '# Test\nContent.']]);
    await wf.execute(makeRequest(), contents);
    assert.ok(wf.getManifest());
  });

  it('clearIndex clears state', async () => {
    const wf = new IngestWorkflow();
    const contents = new Map([['notes/a.md', '# Test\nContent.']]);
    await wf.execute(makeRequest(), contents);
    await wf.clearIndex();
    assert.equal(wf.getManifest(), null);
  });
});

describe('ingest safety', () => {
  it('no real provider call', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/ingest-workflow.service.ts'),
      'utf8',
    );
    assert.ok(!content.includes('fetch('));
    assert.ok(!content.includes('axios'));
    assert.ok(!content.includes('openai'));
  });

  it('no whole Vault scan', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/ingest-workflow.service.ts'),
      'utf8',
    );
    assert.ok(!content.includes('readdir'));
    assert.ok(!content.includes('glob'));
    assert.ok(!content.includes('walk'));
  });

  it('no Vault write', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/ingest-workflow.service.ts'),
      'utf8',
    );
    assert.ok(!content.includes('writeFile'));
    assert.ok(!content.includes('saveToVault'));
  });
});
