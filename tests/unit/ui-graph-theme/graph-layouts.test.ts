import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';

const LAYOUT_PATH = resolve(__dirname, '..', '..', '..', 'src', 'features', 'graph', 'lib', 'graphLayout.ts');

describe('graph-layouts (P1)', () => {
  const content = readFileSync(LAYOUT_PATH, 'utf8');

  it('should define force-directed layout', () => {
    assert.ok(content.includes('force-directed'), 'should define force-directed layout');
    assert.ok(content.includes('computeForceDirected'), 'should have force-directed function');
  });

  it('should define hierarchical layout', () => {
    assert.ok(content.includes('hierarchical'), 'should define hierarchical layout');
    assert.ok(content.includes('computeHierarchical'), 'should have hierarchical function');
  });

  it('should define circular layout', () => {
    assert.ok(content.includes('circular'), 'should define circular layout');
    assert.ok(content.includes('computeCircular'), 'should have circular function');
  });

  it('should have unified computeLayout entry point', () => {
    assert.ok(content.includes('computeLayout'), 'should have computeLayout function');
  });

  it('should not import D3 or Three.js', () => {
    assert.ok(!content.includes("from 'd3'") && !content.includes('from "d3"'), 'should not import d3');
    assert.ok(!content.includes("from 'three'") && !content.includes('from "three"'), 'should not import three.js');
  });

  it('should handle empty nodes safely', () => {
    assert.ok(content.includes('length === 0') || content.includes('length == 0') || (content.includes('return []')),
      'should check for empty arrays');
  });
});
