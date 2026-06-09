import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';

const LICENSE_PATH = resolve(__dirname, '..', '..', '..', 'src', 'assets', 'file-icons', 'LICENSE');
const ICONS_DIR = resolve(__dirname, '..', '..', '..', 'src', 'assets', 'file-icons');

describe('filetree-icon-license-boundary (P0)', () => {
  it('LICENSE file should exist', () => {
    assert.ok(existsSync(LICENSE_PATH), 'LICENSE should exist in src/assets/file-icons/');
  });

  it('LICENSE should mention MIT', () => {
    const content = readFileSync(LICENSE_PATH, 'utf8');
    assert.ok(
      content.includes('MIT') || content.includes('mit'),
      'LICENSE should mention MIT license',
    );
  });

  it('LICENSE should not be empty', () => {
    const content = readFileSync(LICENSE_PATH, 'utf8');
    assert.ok(content.length > 50, 'LICENSE should have substantial content');
  });
});
