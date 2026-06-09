import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { describe, it } from 'vitest';

const ICONS_DIR = resolve(__dirname, '..', '..', '..', 'src', 'assets', 'file-icons');

const FORBIDDEN_SVG_PATTERNS = [
  '<script',
  '<foreignObject',
  'href="http',
  'href=\'http',
  'onclick=',
  'onload=',
  'onerror=',
  'onmouseover=',
  'xlink:href="http',
];

describe('filetree-svg-safety (P0)', () => {
  const svgFiles = readdirSync(ICONS_DIR).filter((f) => f.endsWith('.svg'));

  it('should have SVG files to check', () => {
    assert.ok(svgFiles.length > 0, 'Should have SVG icon files');
  });

  for (const file of svgFiles) {
    it(`${file} should not contain script tags`, () => {
      const content = readFileSync(join(ICONS_DIR, file), 'utf8');
      assert.ok(!content.includes('<script'), `${file} should not contain script tags`);
    });

    it(`${file} should not contain foreignObject`, () => {
      const content = readFileSync(join(ICONS_DIR, file), 'utf8');
      assert.ok(!content.includes('<foreignObject'), `${file} should not contain foreignObject`);
    });

    it(`${file} should not contain external URLs`, () => {
      const content = readFileSync(join(ICONS_DIR, file), 'utf8');
      assert.ok(!content.includes('href="http'), `${file} should not contain external URLs`);
      assert.ok(!content.includes("href='http"), `${file} should not contain external URLs`);
    });

    it(`${file} should not contain event handlers`, () => {
      const content = readFileSync(join(ICONS_DIR, file), 'utf8');
      assert.ok(!content.includes('onclick='), `${file} should not have onclick handler`);
      assert.ok(!content.includes('onload='), `${file} should not have onload handler`);
    });
  }
});
