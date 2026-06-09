import { mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { resolveVaultPath, toVaultRelativePath } from '../../electron/security/path-guard';

async function run(): Promise<void> {
  const rootPath = path.join(os.tmpdir(), `schola-path-guard-${Date.now()}`);
  await mkdir(rootPath, { recursive: true });

  try {
    const insidePath = resolveVaultPath(rootPath, 'notes/example.md');
    assert.equal(insidePath, path.resolve(rootPath, 'notes/example.md'));
    assert.equal(toVaultRelativePath(rootPath, path.join(rootPath, 'notes', 'example.md')), 'notes/example.md');
    assert.throws(() => resolveVaultPath(rootPath, '../escape.md'), /escapes/);
    assert.throws(() => resolveVaultPath(rootPath, path.resolve(rootPath, '..', 'escape.md')), /absolute/);
  } finally {
    await rm(rootPath, { recursive: true, force: true });
  }
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});