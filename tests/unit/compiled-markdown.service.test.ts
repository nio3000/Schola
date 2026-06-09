/**
 * Compiled Markdown Artifact Tests — Phase 4-2-G.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import type { CompileRequest } from '../../src/lib/contracts/compiled-markdown.types';
import { generateCompileId, generateCompileReport } from '../../src/lib/contracts/compiled-markdown.types';
import { CompiledMarkdownService } from '../../electron/services/compiled-markdown.service';

function makeRequest(overrides?: Partial<CompileRequest>): CompileRequest {
  return {
    title: 'Test Compile',
    mode: 'summary',
    source: 'selected_files',
    selectedFiles: [{ relativePath: 'notes/a.md', displayName: 'a.md' }],
    ...overrides,
  };
}

describe('CompiledMarkdownArtifact', () => {
  it('generates unique IDs', () => {
    assert.notEqual(generateCompileId(), generateCompileId());
  });

  it('compile from selected files', () => {
    const svc = new CompiledMarkdownService();
    const result = svc.compile(makeRequest());
    assert.equal(result.status, 'success');
    assert.ok(result.artifact);
    assert.ok(result.artifact.isMockArtifact);
    assert.ok(result.artifact.sections.some((s) => s.heading.includes('Source Files')));
  });

  it('compile from query result', () => {
    const svc = new CompiledMarkdownService();
    const result = svc.compile(makeRequest({
      mode: 'results',
      source: 'query_result',
      queryResult: {
        sources: [{ relativePath: 'notes/b.md', chunkIndex: 0, headingPath: ['# Results'], score: 0.9 }],
        evidence: [],
      },
    }));
    assert.ok(result.artifact);
    assert.ok(result.artifact.sections.some((s) => s.heading.includes('Results')));
  });

  it('no source → insufficient evidence section', () => {
    const svc = new CompiledMarkdownService();
    const result = svc.compile(makeRequest({ source: 'query_result', selectedFiles: [] }));
    assert.ok(result.artifact);
    assert.ok(result.artifact.sections.some((s) => s.isInsufficientEvidence));
  });

  it('review marks artifact as reviewed', () => {
    const svc = new CompiledMarkdownService();
    const r = svc.compile(makeRequest());
    const ok = svc.review(r.artifact!.id);
    assert.ok(ok.ok);
    assert.equal(svc.getArtifact(r.artifact!.id)?.status, 'reviewed');
  });

  it('rejects empty title', () => {
    const svc = new CompiledMarkdownService();
    const r = svc.compile(makeRequest({ title: '' }));
    assert.equal(r.status, 'failed');
  });

  it('generateCompileReport produces valid report', () => {
    const svc = new CompiledMarkdownService();
    const r = svc.compile(makeRequest());
    const report = generateCompileReport(r.artifact!);
    assert.ok(report.sectionsCompiled > 0);
    assert.ok(report.canSave === false); // not reviewed yet
  });

  it('listArtifacts / clear work', () => {
    const svc = new CompiledMarkdownService();
    svc.compile(makeRequest());
    assert.equal(svc.listArtifacts().length, 1);
    svc.clear();
    assert.equal(svc.listArtifacts().length, 0);
  });

  it('SourceRef relativePath-only in sections', () => {
    const svc = new CompiledMarkdownService();
    const r = svc.compile(makeRequest());
    for (const s of r.artifact!.sections) {
      for (const src of s.sources) {
        assert.ok(!src.relativePath.includes(':\\'));
        assert.ok(!src.relativePath.includes('\\\\'));
      }
    }
  });
});

describe('compiled markdown safety', () => {
  it('no real provider call in service', () => {
    const c = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/compiled-markdown.service.ts'), 'utf8');
    assert.ok(!c.includes('fetch('));
    assert.ok(!c.includes('axios'));
  });

  it('no Vault write', () => {
    const c = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/compiled-markdown.service.ts'), 'utf8');
    assert.ok(!c.includes('writeFile'));
    assert.ok(!c.includes('saveToVault'));
  });

  it('no Phase 4-3/4-4/5', () => {
    const c = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/compiled-markdown.types.ts'), 'utf8');
    assert.ok(!c.includes('Phase 4-3'));
    assert.ok(!c.includes('Phase 4-4'));
    assert.ok(!c.includes('Phase 5'));
  });

  it('no external database claim', () => {
    const c = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/compiled-markdown.service.ts'), 'utf8');
    assert.ok(!c.includes('PubMed'));
    assert.ok(!c.includes('Crossref'));
  });
});
