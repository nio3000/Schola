import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..', '..');

function readIfExists(relativePath: string): string | null {
  const full = resolve(ROOT, relativePath);
  if (existsSync(full)) return readFileSync(full, 'utf8');
  return null;
}

describe('third-party-notices-boundary (P0)', () => {
  it('THIRD_PARTY_NOTICES.md should exist at project root', () => {
    const notices = readIfExists('THIRD_PARTY_NOTICES.md');
    assert.ok(notices !== null, 'THIRD_PARTY_NOTICES.md must exist at project root');
  });

  it('THIRD_PARTY_NOTICES.md should mention Material Icon Theme', () => {
    const notices = readIfExists('THIRD_PARTY_NOTICES.md');
    if (notices === null) { assert.fail('THIRD_PARTY_NOTICES.md does not exist'); return; }
    assert.ok(
      notices.toLowerCase().includes('material icon theme'),
      'THIRD_PARTY_NOTICES.md should mention Material Icon Theme',
    );
  });

  it('THIRD_PARTY_NOTICES.md should mention MIT license', () => {
    const notices = readIfExists('THIRD_PARTY_NOTICES.md');
    if (notices === null) return;
    assert.ok(
      notices.toLowerCase().includes('mit'),
      'THIRD_PARTY_NOTICES.md should mention MIT license',
    );
  });

  it('src/assets/file-icons/LICENSE should exist', () => {
    const license = readIfExists('src/assets/file-icons/LICENSE');
    assert.ok(license !== null, 'src/assets/file-icons/LICENSE must exist');
    if (license !== null) {
      assert.ok(license.includes('MIT'), 'LICENSE should mention MIT');
    }
  });

  it('Bearded Theme references should only be negative compliance statements', () => {
    const notices = readIfExists('THIRD_PARTY_NOTICES.md');
    if (notices === null) return;
    const lower = notices.toLowerCase();
    // If "bearded" appears, it must be in a "no bearded theme" negative statement
    if (lower.includes('bearded')) {
      assert.ok(
        lower.includes('no bearded'),
        'Any Bearded Theme reference must be a "No Bearded Theme" compliance statement',
      );
    }
    // "No GPL-licensed..." is a valid negative compliance statement
    if (lower.includes('gpl') && !lower.includes('no gpl')) {
      assert.fail('Should NOT contain positive GPL license references');
    }
  });
});
