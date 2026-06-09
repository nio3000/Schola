/**
 * MemoryTree Contract Tests — Phase 4-2-F.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'vitest';
import type { MemoryTreeNode, MemoryTree } from '../../src/lib/contracts/memory-tree.types';
import {
  validateMemoryTreeNode,
  generateNodeId,
  generateTreeId,
  createEmptyTree,
} from '../../src/lib/contracts/memory-tree.types';

describe('MemoryTree contract', () => {
  it('generates unique node IDs', () => {
    const id1 = generateNodeId();
    const id2 = generateNodeId();
    assert.notEqual(id1, id2);
  });

  it('generates tree IDs with mt- prefix', () => {
    const id = generateTreeId();
    assert.ok(id.startsWith('mt-'));
  });

  it('createEmptyTree returns valid structure', () => {
    const tree = createEmptyTree('research', 'Test Tree');
    assert.equal(tree.category, 'research');
    assert.equal(tree.root.type, 'topic');
    assert.equal(tree.totalNodes, 1);
    assert.ok(tree.isMockTree);
  });

  it('validateMemoryTreeNode detects absolute paths in sources', () => {
    const node: MemoryTreeNode = {
      id: 'n1',
      title: 'Test',
      type: 'topic',
      summary: '',
      children: [],
      sources: [{ relativePath: 'C:\\bad.md', chunkIndex: 0, headingPath: [], score: 1 }],
      evidence: [],
      confidence: 1,
      completeness: 0,
      createdAt: '',
      updatedAt: '',
    };
    const result = validateMemoryTreeNode(node);
    assert.equal(result.valid, false);
    assert.ok(result.issues.length > 0);
  });

  it('validateMemoryTreeNode rejects out-of-range confidence', () => {
    const node: MemoryTreeNode = {
      id: 'n1', title: 'T', type: 'topic', summary: '', children: [],
      sources: [], evidence: [], confidence: 2, completeness: 0,
      createdAt: '', updatedAt: '',
    };
    assert.equal(validateMemoryTreeNode(node).valid, false);
  });

  it('validateMemoryTreeNode accepts valid node', () => {
    const node: MemoryTreeNode = {
      id: 'n1', title: 'Valid', type: 'topic', summary: 'Summary',
      children: [],
      sources: [{ relativePath: 'notes/a.md', chunkIndex: 0, headingPath: [], score: 0.9 }],
      evidence: [],
      confidence: 0.9,
      completeness: 0.5,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    assert.equal(validateMemoryTreeNode(node).valid, true);
  });
});

describe('memory tree safety', () => {
  it('no absolute path in contract file', () => {
    const c = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/memory-tree.types.ts'), 'utf8');
    assert.ok(!c.includes('C:\\'));
    assert.ok(!c.includes('apiKey'));
  });

  it('no Phase 4-3/4-4/5 in contract', () => {
    const c = fs.readFileSync(
      path.resolve(__dirname, '../../src/lib/contracts/memory-tree.types.ts'), 'utf8');
    assert.ok(!c.includes('Phase 4-3'));
    assert.ok(!c.includes('Phase 4-4'));
    assert.ok(!c.includes('Phase 5'));
  });
});
