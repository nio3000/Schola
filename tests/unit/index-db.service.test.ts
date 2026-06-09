/**
 * Unit test for IndexDbService — wiki index write operations.
 *
 * Run: npx tsx tests/unit/index-db.service.test.ts
 */

import { mkdirSync, writeFileSync, readFileSync, unlinkSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { IndexDbService, closeAllIndexDbs, getIndexDbForVault } from '../../electron/services/index-db.service';
import type { FileEntry } from '../../src/lib/contracts/vault.types';

/** Build a minimal FileEntry tree for resolution tests. */
function makeFileTree(paths: string[]): readonly FileEntry[] {
  const entries: FileEntry[] = [];
  for (const p of paths) {
    const name = p.split('/').pop()!;
    entries.push({ id: p, name, relativePath: p, type: 'file' });
  }
  return entries;
}

async function run(): Promise<void> {
  const tmpBase = path.join(os.tmpdir(), `schola-db-wiki-${Date.now()}`);
  const rootPath = path.join(tmpBase, 'vault');
  mkdirSync(rootPath, { recursive: true });
  const vaultId = 'test-vault-wiki';

  // Create test files on disk so indexWikiFile can work
  writeFileSync(path.join(rootPath, 'alpha.md'), '# Alpha\n\nLinks: [[beta]] [[gamma]]', 'utf-8');
  writeFileSync(path.join(rootPath, 'beta.md'), '# Beta\n\nTarget of alpha.', 'utf-8');
  writeFileSync(path.join(rootPath, 'gamma.md'), '# Gamma\n\n', 'utf-8');

  const fileTree = makeFileTree(['alpha.md', 'beta.md', 'gamma.md']);

  try {
    // ── 1. indexWikiFile writes resolved links ──
    const svc = new IndexDbService(vaultId, rootPath);
    svc.open();
    const db = svc.getDatabase()!;

    svc.indexWikiFile('alpha.md', '# Alpha\n\nLinks: [[beta]] [[gamma]]', fileTree);

    const links = db.prepare(
      'SELECT * FROM links WHERE source_path = ? ORDER BY raw_target',
    ).all('alpha.md') as { raw_target: string; target_path: string }[];
    assert.equal(links.length, 2, 'alpha.md should have 2 resolved links');
    assert.equal(links[0].raw_target, 'beta');
    assert.equal(links[0].target_path, 'beta.md');
    assert.equal(links[1].raw_target, 'gamma');
    assert.equal(links[1].target_path, 'gamma.md');

    // ── 2. indexWikiFile writes headings with correct levels ──
    const headings = db.prepare(
      'SELECT * FROM headings WHERE relative_path = ? ORDER BY order_index',
    ).all('alpha.md') as { text: string; level: number; order_index: number }[];
    assert.equal(headings.length, 1, 'alpha.md should have 1 heading');
    assert.equal(headings[0].text, 'Alpha');
    assert.equal(headings[0].level, 1, 'H1 should have level=1');
    assert.equal(headings[0].order_index, 0);

    // ── 3. indexWikiFile writes file_metadata ──
    const meta = db.prepare(
      'SELECT * FROM file_metadata WHERE relative_path = ?',
    ).get('alpha.md') as { file_name: string; exists_flag: number } | undefined;
    assert.ok(meta, 'file_metadata should exist');
    assert.equal(meta!.file_name, 'alpha.md');
    assert.equal(meta!.exists_flag, 1);

    // ── 4. unresolved_links for non-existent target ──
    svc.indexWikiFile('alpha.md', '# Alpha\n\nLinks: [[beta]] [[delta]]', fileTree);
    const unresolved = db.prepare(
      'SELECT * FROM unresolved_links WHERE source_path = ? ORDER BY raw_target',
    ).all('alpha.md') as { raw_target: string }[];
    // beta is resolved (exists), delta is unresolved (doesn't exist)
    assert.equal(unresolved.length, 1, 'should have 1 unresolved link (delta)');
    assert.equal(unresolved[0].raw_target, 'delta');

    // ── 5. Re-index replaces old links (no stale gamma) ──
    const links2 = db.prepare(
      'SELECT raw_target FROM links WHERE source_path = ?',
    ).all('alpha.md') as { raw_target: string }[];
    assert.equal(links2.length, 1, 'only beta should be resolved after re-index');
    assert.equal(links2[0].raw_target, 'beta');

    // ── 6. removeWikiFile cleans up ──
    svc.removeWikiFile('alpha.md');
    const linksAfter = db.prepare(
      'SELECT COUNT(*) as cnt FROM links WHERE source_path = ?',
    ).get('alpha.md') as { cnt: number };
    assert.equal(linksAfter.cnt, 0, 'no links after remove');
    const metaAfter = db.prepare(
      'SELECT exists_flag FROM file_metadata WHERE relative_path = ?',
    ).get('alpha.md') as { exists_flag: number } | undefined;
    assert.ok(metaAfter, 'metadata should still exist');
    assert.equal(metaAfter!.exists_flag, 0, 'exists_flag should be 0');

    // ── 7. rebuildWikiIndex populates all files ──
    await svc.rebuildWikiIndex(fileTree, async (rp: string) => {
      const ap = path.join(rootPath, rp);
      return readFileSync(ap, 'utf-8');
    });
    const totalLinks = db.prepare('SELECT COUNT(*) as cnt FROM links').get() as { cnt: number };
    assert.ok(totalLinks.cnt >= 2, 'rebuild should have at least alpha→beta + alpha→gamma');
    const totalHeadings = db.prepare('SELECT COUNT(*) as cnt FROM headings').get() as { cnt: number };
    assert.ok(totalHeadings.cnt >= 3, 'rebuild should have at least 3 headings');

    // ── 8. Heading levels from H1 to H6 are correct ──
    writeFileSync(path.join(rootPath, 'levels.md'),
      '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6', 'utf-8');
    const fileTree2 = makeFileTree(['alpha.md', 'beta.md', 'gamma.md', 'levels.md']);
    svc.indexWikiFile('levels.md',
      '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6', fileTree2);
    const levelRows = db.prepare(
      'SELECT level, text, order_index FROM headings WHERE relative_path = ? ORDER BY order_index',
    ).all('levels.md') as { level: number; text: string; order_index: number }[];
    assert.equal(levelRows.length, 6, 'should have 6 headings');
    const expected = [
      { level: 1, text: 'H1', oi: 0 },
      { level: 2, text: 'H2', oi: 1 },
      { level: 3, text: 'H3', oi: 2 },
      { level: 4, text: 'H4', oi: 3 },
      { level: 5, text: 'H5', oi: 4 },
      { level: 6, text: 'H6', oi: 5 },
    ];
    for (let i = 0; i < expected.length; i++) {
      assert.equal(levelRows[i].level, expected[i].level,
        `heading ${i + 1} level should be ${expected[i].level}`);
      assert.equal(levelRows[i].text, expected[i].text,
        `heading ${i + 1} text should be ${expected[i].text}`);
      assert.equal(levelRows[i].order_index, expected[i].oi,
        `heading ${i + 1} order_index should be ${expected[i].oi}`);
    }

    // ── 9. Chinese heading level is correct ──
    svc.indexWikiFile('levels.md', '## 中文标题\n\ncontent', fileTree2);
    const zhHeadings = db.prepare(
      'SELECT level, text FROM headings WHERE relative_path = ?',
    ).all('levels.md') as { level: number; text: string }[];
    assert.equal(zhHeadings.length, 1, 're-index should replace old headings');
    assert.equal(zhHeadings[0].text, '中文标题');
    assert.equal(zhHeadings[0].level, 2);

    // ── 10. indexSearchFile writes search_index ──
    svc.indexSearchFile('alpha.md', '# Alpha\n\nLinks: [[beta]] [[gamma]]');
    const searchRow = db.prepare(
      'SELECT * FROM search_index WHERE relative_path = ?',
    ).get('alpha.md') as { file_name: string; directory: string; title: string; headings_text: string; wikilink_targets_text: string } | undefined;
    assert.ok(searchRow, 'search_index row should exist');
    assert.equal(searchRow!.file_name, 'alpha.md');
    assert.equal(searchRow!.directory, '');
    assert.equal(searchRow!.title, 'Alpha');
    assert.ok(searchRow!.headings_text.includes('Alpha'), 'headings_text should contain heading');
    assert.ok(searchRow!.wikilink_targets_text.includes('beta'), 'wikilink_targets_text should contain beta');
    assert.ok(searchRow!.wikilink_targets_text.includes('gamma'), 'wikilink_targets_text should contain gamma');

    // ── 11. Re-index replaces old search item ──
    svc.indexSearchFile('alpha.md', '# New Title\n\nOnly [[delta]]');
    const updatedRow = db.prepare(
      'SELECT title, wikilink_targets_text FROM search_index WHERE relative_path = ?',
    ).get('alpha.md') as { title: string; wikilink_targets_text: string };
    assert.equal(updatedRow.title, 'New Title');
    assert.ok(!updatedRow.wikilink_targets_text.includes('beta'), 'old target should be gone');
    assert.ok(updatedRow.wikilink_targets_text.includes('delta'), 'new target should be present');

    // ── 12. removeSearchFile ──
    svc.removeSearchFile('alpha.md');
    const afterRemove = db.prepare(
      'SELECT COUNT(*) as cnt FROM search_index WHERE relative_path = ?',
    ).get('alpha.md') as { cnt: number };
    assert.equal(afterRemove.cnt, 0);
    // links table should NOT be affected
    const linksStill = db.prepare('SELECT COUNT(*) as cnt FROM links').get() as { cnt: number };
    assert.ok(linksStill.cnt > 0, 'links should not be affected by search remove');

    // ── 13. removeSearchFolder ──
    mkdirSync(path.join(rootPath, 'sub'), { recursive: true });
    writeFileSync(path.join(rootPath, 'sub/x.md'), '# X', 'utf-8');
    writeFileSync(path.join(rootPath, 'sub/y.md'), '# Y', 'utf-8');
    svc.indexSearchFile('sub/x.md', '# X');
    svc.indexSearchFile('sub/y.md', '# Y');
    let subCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM search_index WHERE relative_path LIKE 'sub/%'",
    ).get() as { cnt: number }).cnt;
    assert.equal(subCount, 2);
    svc.removeSearchFolder('sub');
    subCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM search_index WHERE relative_path LIKE 'sub/%'",
    ).get() as { cnt: number }).cnt;
    assert.equal(subCount, 0);

    unlinkSync(path.join(rootPath, 'levels.md'));

    // ── 14. .schola/index.db exists on disk ──
    const dbPath = path.join(rootPath, '.schola', 'index.db');
    const dbStat = statSync(dbPath);
    assert.ok(dbStat.isFile(), '.schola/index.db should exist as a file');
    assert.ok(dbStat.size > 0, '.schola/index.db should be non-empty');
    console.log(`  .schola/index.db exists at ${dbPath} (${dbStat.size} bytes)`);

    // ── 15. All expected tables exist ──
    const expectedTables = [
      'schema_migrations',
      'file_metadata',
      'links',
      'unresolved_links',
      'headings',
      'search_index',
    ];
    const tableRows = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    ).all() as { name: string }[];
    const existingTableNames = new Set(tableRows.map((r) => r.name));

    for (const t of expectedTables) {
      assert.ok(
        existingTableNames.has(t),
        `Table '${t}' should exist in .schola/index.db`,
      );
    }
    console.log(`  All ${expectedTables.length} expected tables verified.`);

    // ── 16. schema_migrations has version entry ──
    const migRow = db.prepare(
      'SELECT version, applied_at FROM schema_migrations ORDER BY version DESC LIMIT 1',
    ).get() as { version: number; applied_at: string } | undefined;
    assert.ok(migRow, 'schema_migrations should have at least one row');
    assert.equal(migRow!.version, 1, 'schema version should be 1');
    assert.ok(
      migRow!.applied_at && migRow!.applied_at.length > 0,
      'applied_at should be a non-empty timestamp',
    );
    console.log(`  Schema version: ${migRow!.version}, applied at: ${migRow!.applied_at}`);

    // ── 17. node:sqlite DatabaseSync is used (not better-sqlite3) ──
    assert.ok(
      db.constructor === DatabaseSync,
      'Database should be an instance of node:sqlite DatabaseSync',
    );
    // Verify no better-sqlite3 in play
    try {
      require.resolve('better-sqlite3');
      assert.fail('better-sqlite3 should not be resolvable');
    } catch {
      // Expected — better-sqlite3 not installed
      console.log('  node:sqlite DatabaseSync confirmed (better-sqlite3 not found).');
    }

    // ── 18. close() releases the database ──
    svc.close();
    // After close, getDatabase() should return null
    assert.equal(svc.getDatabase(), null, 'getDatabase() should return null after close()');
    console.log('  close() verified — database released.');

    // ── 19. closeAllIndexDbs cleans up all instances ──
    closeAllIndexDbs();
    // All vault registrations should be cleared
    const afterAllClose = getIndexDbForVault(vaultId);
    assert.equal(afterAllClose, null, 'getIndexDbForVault should return null after closeAllIndexDbs');
    console.log('  closeAllIndexDbs() verified.');

    console.log('PASS: all wiki index db tests passed.');
  } finally {
    closeAllIndexDbs();
    try { rmSync(tmpBase, { recursive: true, force: true, maxRetries: 3 }); } catch { /* cleanup */ }
  }
}

run().catch((err) => {
  console.error('FAIL:', err);
  process.exit(1);
});
