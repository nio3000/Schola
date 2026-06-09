/**
 * Unit test for Graph query IPC — getGraphData method.
 *
 * Run: npx tsx tests/unit/graph-query.test.ts
 *
 * Phase 2-D-1
 */

import { mkdirSync, writeFileSync, readFileSync, rmSync, statSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { IndexDbService, closeAllIndexDbs } from '../../electron/services/index-db.service';
import { getMarkdownPaths } from '../../src/lib/fileTreeUtils';
import { GRAPH_MAX_NODES } from '../../src/lib/contracts/graph-query.types';
import { EXPECTED_SCHEMA_VERSION } from '../../electron/db/schema';

/** Scan a directory for .md/.markdown files. */
function scanDir(dir: string, prefix = ''): { id: string; name: string; relativePath: string; type: 'file' }[] {
  const entries: { id: string; name: string; relativePath: string; type: 'file' }[] = [];
  const items = readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const rel = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) {
      entries.push(...scanDir(path.join(dir, item.name), rel));
    } else if (item.name.endsWith('.md') || item.name.endsWith('.markdown')) {
      entries.push({ id: rel, name: item.name, relativePath: rel, type: 'file' });
    }
  }
  return entries;
}

async function run(): Promise<void> {
  const tmpBase = path.join(os.tmpdir(), `schola-graph-test-${Date.now()}`);
  const rootPath = path.join(tmpBase, 'vault');
  mkdirSync(rootPath, { recursive: true });
  const vaultId = 'test-vault-graph';

  // Write graph-vault fixture files
  writeFileSync(path.join(rootPath, 'README.md'), '# README\n\nMain entry point.\n', 'utf-8');
  writeFileSync(path.join(rootPath, 'research.md'), '# Research\n\nSee [[README]] and [[methods]].\n', 'utf-8');
  writeFileSync(path.join(rootPath, 'methods.md'), '# Methods\n\nBased on [[README]]. Also links to [[MissingPage]].\n', 'utf-8');
  writeFileSync(path.join(rootPath, 'orphan.md'), '# Orphan\n\nNo links.\n', 'utf-8');
  mkdirSync(path.join(rootPath, 'folder'), { recursive: true });
  writeFileSync(path.join(rootPath, 'folder', 'note.md'), '# Folder Note\n\nRef: [[README]]\n', 'utf-8');

  const fileTree = scanDir(rootPath);

  let passed = 0;
  let failed = 0;

  try {
    const svc = new IndexDbService(vaultId, rootPath);
    svc.open();

    // Rebuild wiki + search indices
    const readNote = async (rp: string): Promise<string> => {
      return readFileSync(path.join(rootPath, rp), 'utf-8');
    };

    for (const rp of getMarkdownPaths(fileTree)) {
      try {
        const content = await readNote(rp);
        const st = statSync(path.join(rootPath, rp));
        svc.indexWikiFile(rp, content, fileTree, { mtimeMs: st.mtimeMs, sizeBytes: st.size });
        svc.indexSearchFile(rp, content);
      } catch { /* skip */ }
    }

    // ═══════════════════════════════════════════════
    // A. Normal graph returns nodes + edges
    // ═══════════════════════════════════════════════
    console.log('\n[A] Normal graph');
    const result = svc.getGraphData(GRAPH_MAX_NODES);
    assert.equal(result.truncated, false, 'should not be truncated');
    assert.ok(result.nodes.length >= 5, `expected >=5 nodes, got ${result.nodes.length}`);
    assert.ok(result.edges.length >= 4, `expected >=4 edges, got ${result.edges.length}`);
    assert.ok(result.totalNodes >= result.nodes.length);

    // File nodes present
    const nodeIds = new Set(result.nodes.map((n) => n.id));
    assert.ok(nodeIds.has('README.md'), 'README.md should be in nodes');
    assert.ok(nodeIds.has('research.md'), 'research.md should be in nodes');
    assert.ok(nodeIds.has('methods.md'), 'methods.md should be in nodes');
    assert.ok(nodeIds.has('orphan.md'), 'orphan.md should be in nodes');
    assert.ok(nodeIds.has('folder/note.md'), 'folder/note.md should be in nodes');
    console.log(`  ✅ ${result.nodes.length} nodes, ${result.edges.length} edges`);
    passed += 1;

    // ═══════════════════════════════════════════════
    // B. Unresolved node
    // ═══════════════════════════════════════════════
    console.log('\n[B] Unresolved node');
    const unresNode = result.nodes.find((n) => n.kind === 'unresolved');
    assert.ok(unresNode, 'should have unresolved node');
    assert.equal(unresNode!.label, 'MissingPage');
    assert.equal(unresNode!.relativePath, null);
    assert.equal(unresNode!.linkCount, 0);

    // Unresolved edge
    const unresEdges = result.edges.filter((e) => e.kind === 'unresolved');
    assert.ok(unresEdges.length >= 1, 'should have unresolved edges');
    const unresEdge = unresEdges.find((e) => e.source === 'methods.md');
    assert.ok(unresEdge, 'should have methods.md → MissingPage edge');
    assert.ok(unresEdge!.target.startsWith('unresolved:'));
    console.log(`  ✅ unresolved node: ${unresNode!.id}, edges: ${unresEdges.length}`);
    passed += 1;

    // ═══════════════════════════════════════════════
    // C. Orphan file node
    // ═══════════════════════════════════════════════
    console.log('\n[C] Orphan file');
    const orphanNode = result.nodes.find((n) => n.id === 'orphan.md');
    assert.ok(orphanNode, 'orphan.md should be in nodes');
    assert.equal(orphanNode!.isOrphan, true, 'orphan.md should be orphan');
    assert.equal(orphanNode!.linkCount, 0);
    assert.equal(orphanNode!.backlinkCount, 0);
    assert.equal(orphanNode!.kind, 'file');
    console.log('  ✅ orphan.md isOrphan=true');
    passed += 1;

    // ═══════════════════════════════════════════════
    // D. maxNodes clamp
    // ═══════════════════════════════════════════════
    console.log('\n[D] maxNodes clamp');
    const clamped = svc.getGraphData(999);
    assert.ok(clamped.nodes.length <= GRAPH_MAX_NODES, `should be <= 200, got ${clamped.nodes.length}`);
    console.log(`  ✅ maxNodes=999 clamped to ${GRAPH_MAX_NODES}, nodes=${clamped.nodes.length}`);
    passed += 1;

    // ═══════════════════════════════════════════════
    // E. Truncation (maxNodes=3, 6 nodes exist)
    // ═══════════════════════════════════════════════
    console.log('\n[E] Truncation');
    const truncated = svc.getGraphData(3);
    assert.equal(truncated.truncated, true, 'should be truncated');
    assert.ok(truncated.totalNodes > 3, 'totalNodes should exceed limit');
    assert.ok(truncated.nodes.length <= 3, 'nodes should be truncated');
    console.log(`  ✅ truncated=true, total=${truncated.totalNodes}, shown=${truncated.nodes.length}`);
    passed += 1;

    // ═══════════════════════════════════════════════
    // F. Title from heading
    // ═══════════════════════════════════════════════
    console.log('\n[F] Title from heading');
    const readmeNode = result.nodes.find((n) => n.id === 'README.md');
    assert.ok(readmeNode, 'README.md should exist');
    assert.equal(readmeNode!.title, 'README', 'title should be from heading');
    assert.equal(readmeNode!.label, 'README', 'label should use title');
    console.log(`  ✅ README.md title="README" label="README"`);
    passed += 1;

    // ═══════════════════════════════════════════════
    // G. Resolved edge from research → README
    // ═══════════════════════════════════════════════
    console.log('\n[G] Research → README edge');
    const edge = result.edges.find(
      (e) => e.kind === 'wikilink' && e.source === 'research.md' && e.target === 'README.md',
    );
    assert.ok(edge, 'should have research.md → README.md edge');
    assert.equal(edge!.label, 'README');
    console.log('  ✅ research.md → README.md edge found');
    passed += 1;

    // ═══════════════════════════════════════════════
    // H. Backlink count
    // ═══════════════════════════════════════════════
    console.log('\n[H] Backlink count');
    // README.md is linked by research.md, methods.md, folder/note.md
    assert.ok(readmeNode!.backlinkCount >= 3, `README.md backlinks should be >=3, got ${readmeNode!.backlinkCount}`);
    console.log(`  ✅ README.md backlinkCount=${readmeNode!.backlinkCount}`);
    passed += 1;

    // ═══════════════════════════════════════════════
    // I. Schema unchanged
    // ═══════════════════════════════════════════════
    console.log('\n[I] Schema unchanged');
    assert.equal(EXPECTED_SCHEMA_VERSION, 1, 'EXPECTED_SCHEMA_VERSION should still be 1');
    console.log('  ✅ EXPECTED_SCHEMA_VERSION = 1');
    passed += 1;

    // ═══════════════════════════════════════════════
    // J. Result does not contain DB path
    // ═══════════════════════════════════════════════
    console.log('\n[J] No DB path leak');
    const json = JSON.stringify(result);
    assert.ok(!json.includes('.schola'), 'should not contain .schola');
    assert.ok(!json.includes('index.db'), 'should not contain index.db');
    assert.ok(!json.includes(rootPath), 'should not contain rootPath');
    console.log('  ✅ no DB path in result');
    passed += 1;

  } catch (err) {
    failed += 1;
    console.error('Test failed:', err);
  } finally {
    closeAllIndexDbs();
    try { rmSync(tmpBase, { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

void run();
