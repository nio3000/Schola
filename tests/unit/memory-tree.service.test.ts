/**
 * MemoryTree Service Tests — Phase 4-2-F.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import { MemoryTreeService } from '../../electron/services/memory-tree.service';
import type { MemoryTreeBuildRequest } from '../../src/lib/contracts/memory-tree.types';

describe('MemoryTreeService', () => {
  it('builds tree from selected files', () => {
    const svc = new MemoryTreeService();
    const req: MemoryTreeBuildRequest = {
      category: 'research',
      title: 'Research Methods',
      selectedFiles: [
        { relativePath: 'notes/methods.md', displayName: 'methods.md' },
        { relativePath: 'notes/results.md', displayName: 'results.md' },
      ],
    };
    const result = svc.buildTree(req);
    assert.equal(result.status, 'success');
    assert.ok(result.tree);
    assert.equal(result.tree.category, 'research');
    assert.ok(result.tree.totalNodes >= 3);
    assert.ok(result.tree.isMockTree);
  });

  it('42-TB-170: builds teaching tree', () => {
    const svc = new MemoryTreeService();
    const req: MemoryTreeBuildRequest = {
      category: 'teaching',
      title: 'Course Overview',
      selectedFiles: [
        { relativePath: 'teaching/lecture1.md', displayName: 'lecture1.md' },
      ],
    };
    const result = svc.buildTree(req);
    assert.equal(result.tree?.category, 'teaching');
  });

  it('42-TB-171: includes SourceRef from selected files', () => {
    const svc = new MemoryTreeService();
    const req: MemoryTreeBuildRequest = {
      category: 'research',
      title: 'Test',
      selectedFiles: [
        { relativePath: 'notes/a.md', displayName: 'a.md' },
      ],
    };
    const result = svc.buildTree(req);
    const root = result.tree?.root;
    assert.ok(root);
    const children = root.children as unknown as Array<{
      sources: Array<{ relativePath: string }>;
    }>;
    assert.ok(children.length >= 1);
    for (const child of children) {
      for (const s of child.sources) {
        assert.ok(!s.relativePath.includes(':\\'));
        assert.ok(!s.relativePath.includes('\\\\'));
      }
    }
  });

  it('builds tree with query results', () => {
    const svc = new MemoryTreeService();
    const req: MemoryTreeBuildRequest = {
      category: 'research',
      title: 'Query Results',
      selectedFiles: [{ relativePath: 'notes/a.md', displayName: 'a.md' }],
      queryResult: {
        sources: [
          { relativePath: 'notes/b.md', chunkIndex: 0, headingPath: ['# Results'], score: 0.9 },
        ],
        evidence: [],
      },
    };
    const result = svc.buildTree(req);
    assert.ok(result.tree);
    assert.ok(result.tree.totalNodes >= 2);
  });

  it('getTree retrieves previously built tree', () => {
    const svc = new MemoryTreeService();
    const result = svc.buildTree({
      category: 'research', title: 'T', selectedFiles: [{ relativePath: 'n/a.md', displayName: 'a.md' }],
    });
    const retrieved = svc.getTree(result.tree!.id);
    assert.ok(retrieved);
    assert.equal(retrieved.id, result.tree!.id);
  });

  it('fails with no selected files', () => {
    const svc = new MemoryTreeService();
    const req: MemoryTreeBuildRequest = {
      category: 'research', title: 'Empty', selectedFiles: [],
    };
    const result = svc.buildTree(req);
    assert.equal(result.status, 'failed');
    assert.equal(result.tree, null);
  });

  it('42-TB-172: preserveManualEdits contract', () => {
    const svc = new MemoryTreeService();
    const r = svc.preserveManualEdits('any', [{ nodeId: 'n1', title: 'Updated' }]);
    assert.equal(r.ok, true);
  });

  it('recoverCorruptedTree returns fresh tree', () => {
    const svc = new MemoryTreeService();
    const tree = svc.recoverCorruptedTree('research');
    assert.ok(tree.isMockTree);
    assert.equal(tree.category, 'research');
    assert.equal(tree.totalNodes, 1);
  });

  it('listTrees returns built trees', () => {
    const svc = new MemoryTreeService();
    svc.buildTree({ category: 'research', title: 'T1', selectedFiles: [{ relativePath: 'n/a.md', displayName: 'a.md' }] });
    svc.buildTree({ category: 'teaching', title: 'T2', selectedFiles: [{ relativePath: 'n/b.md', displayName: 'b.md' }] });
    assert.equal(svc.listTrees().length, 2);
  });

  it('clear removes all trees', () => {
    const svc = new MemoryTreeService();
    svc.buildTree({ category: 'research', title: 'T', selectedFiles: [{ relativePath: 'n/a.md', displayName: 'a.md' }] });
    svc.clear();
    assert.equal(svc.listTrees().length, 0);
  });
});

describe('memory tree safety', () => {
  it('no real provider call', () => {
    const c = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/memory-tree.service.ts'), 'utf8');
    assert.ok(!c.includes('fetch('));
    assert.ok(!c.includes('axios'));
  });

  it('no Vault write', () => {
    const c = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/memory-tree.service.ts'), 'utf8');
    assert.ok(!c.includes('writeFile'));
    assert.ok(!c.includes('saveToVault'));
  });

  it('no external database claim', () => {
    const c = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/memory-tree.service.ts'), 'utf8');
    assert.ok(!c.includes('PubMed'));
    assert.ok(!c.includes('Crossref'));
  });

  it('no Phase 4-2-G / 4-3 / 4-4 in service', () => {
    const c = fs.readFileSync(
      path.resolve(__dirname, '../../electron/services/memory-tree.service.ts'), 'utf8');
    assert.ok(!c.includes('CompiledMarkdown'));
    assert.ok(!c.includes('Phase 4-3'));
    assert.ok(!c.includes('Phase 4-4'));
  });
});
