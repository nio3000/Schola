import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';

const SCOPE_PATH = resolve(__dirname, '..', '..', '..', 'src', 'features', 'graph', 'lib', 'graphScope.ts');

describe('graph-scope-boundary (P0)', () => {
  const content = readFileSync(SCOPE_PATH, 'utf8');

  it('should define all 5 scope types', () => {
    assert.ok(content.includes('current-file'), 'should define current-file scope');
    assert.ok(content.includes('selected-files'), 'should define selected-files scope');
    assert.ok(content.includes('folder-project'), 'should define folder-project scope');
    assert.ok(content.includes('custom'), 'should define custom scope');
    assert.ok(content.includes('whole-vault'), 'should define whole-vault scope');
  });

  it('should default to current-file', () => {
    assert.ok(content.includes('current-file'), 'DEFAULT_SCOPE should point to current-file');
  });

  it('should export filter function', () => {
    assert.ok(
      content.includes('export function') &&
        (content.includes('filterNodesByScope') || content.includes('applyScopeFilter')),
      'should export a scope filter function',
    );
  });

  it('should not reference Phase 6 or PRE6', () => {
    assert.ok(!content.includes('Phase 6'), 'should not reference Phase 6');
    assert.ok(!content.includes('PRE6'), 'should not reference PRE6');
  });

  it('should not reference Electron or IPC', () => {
    assert.ok(!content.includes('ipcRenderer'), 'should not use ipcRenderer');
    assert.ok(!content.includes('ipcMain'), 'should not use ipcMain');
  });
});
