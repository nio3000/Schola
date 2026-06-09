/**
 * Graph theme unit test — verifies 6 themes exist with correct structure.
 *
 * Run: npx tsx tests/unit/graph-themes.test.ts
 * Phase 2-D-2
 */

import assert from 'node:assert/strict';
import { GRAPH_THEMES, DEFAULT_GRAPH_THEME } from '../../src/features/graph/lib/graphThemes';

const EXPECTED_IDS = [
  'schola-clinical-light',
  'schola-academic-dark',
  'paper-ink',
  'pathology-glass',
  'blueprint',
  'high-contrast',
] as const;

function run(): void {
  let passed = 0;

  console.log('\n[1] Exactly 6 themes');
  assert.equal(Object.keys(GRAPH_THEMES).length, 6, 'should have exactly 6 themes');
  console.log('  ✅ 6 themes');
  passed += 1;

  console.log('\n[2] All 6 theme IDs exist');
  for (const id of EXPECTED_IDS) {
    assert.ok(GRAPH_THEMES[id], `Theme ${id} should exist`);
    console.log(`  ✅ ${id}`);
  }
  passed += 1;

  console.log('\n[3] All theme IDs unique');
  const ids = Object.values(GRAPH_THEMES).map((t) => t.id);
  assert.equal(new Set(ids).size, 6, 'all theme ids should be unique');
  console.log('  ✅ all unique');
  passed += 1;

  console.log('\n[4] Default theme is schola-clinical-light');
  assert.equal(DEFAULT_GRAPH_THEME, 'schola-clinical-light');
  console.log('  ✅ default = schola-clinical-light');
  passed += 1;

  console.log('\n[5] Each theme has all required fields');
  const nodeKeys = ['file', 'current', 'unresolved', 'orphan', 'stroke', 'currentStroke', 'hoverStroke'];
  const edgeKeys = ['wikilink', 'unresolved', 'muted', 'active'];
  for (const id of EXPECTED_IDS) {
    const t = GRAPH_THEMES[id];
    assert.equal(t.id, id);
    assert.ok(typeof t.name === 'string' && t.name.length > 0, `${id}: name`);
    assert.ok(typeof t.background === 'string', `${id}: background`);
    assert.ok(typeof t.surface === 'string', `${id}: surface`);
    assert.ok(typeof t.grid === 'string', `${id}: grid`);
    assert.ok(typeof t.text === 'string', `${id}: text`);
    assert.ok(typeof t.mutedText === 'string', `${id}: mutedText`);
    for (const k of nodeKeys) {
      assert.ok(typeof (t.node as Record<string, unknown>)[k] === 'string', `${id}: node.${k}`);
    }
    for (const k of edgeKeys) {
      assert.ok(typeof (t.edge as Record<string, unknown>)[k] === 'string', `${id}: edge.${k}`);
    }
  }
  console.log('  ✅ all themes have complete fields');
  passed += 1;

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`Results: ${passed}/5 passed`);
}

run();
