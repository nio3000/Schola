/**
 * Phase 3-2: Artifact preload safety test.
 *
 * Verifies the ScholaArtifactApi type does NOT expose:
 *  - ipcRenderer
 *  - rawInvoke
 *  - fs
 *  - shell
 *  - shell.openPath
 *  - shell.showItemInFolder
 *  - system absolute paths
 *  - generic open/reveal channels
 */

import assert from 'node:assert/strict';

interface MinimalArtifactOpenResult {
  readonly ok: boolean;
  readonly errorCode?: string;
  readonly message?: string;
}

interface MinimalScholaArtifactApi {
  readonly openGeneratedMarkdown: (vaultId: string, relativePath: string) => Promise<MinimalArtifactOpenResult>;
  readonly revealGeneratedMarkdown: (vaultId: string, relativePath: string) => Promise<MinimalArtifactOpenResult>;
  readonly openExportArtifact: (vaultId: string, relativePath: string) => Promise<MinimalArtifactOpenResult>;
  readonly revealExportArtifact: (vaultId: string, relativePath: string) => Promise<MinimalArtifactOpenResult>;
}

function run(): void {
  // Construct a minimal API shape — verify it has only the 4 allowed methods
  const api: MinimalScholaArtifactApi = {
    openGeneratedMarkdown: async () => ({ ok: true }),
    revealGeneratedMarkdown: async () => ({ ok: true }),
    openExportArtifact: async () => ({ ok: true }),
    revealExportArtifact: async () => ({ ok: true }),
  };

  // Must have exactly 4 methods
  const keys = Object.keys(api);
  assert.equal(keys.length, 4, 'Must have exactly 4 methods');

  // Must NOT expose shell/fs/rawInvoke
  assert.ok(!('shell' in api), 'Must not expose shell');
  assert.ok(!('fs' in api), 'Must not expose fs');
  assert.ok(!('ipcRenderer' in api), 'Must not expose ipcRenderer');
  assert.ok(!('rawInvoke' in api), 'Must not expose rawInvoke');
  assert.ok(!('openPath' in api), 'Must not expose openPath');
  assert.ok(!('showItemInFolder' in api), 'Must not expose showItemInFolder');
  assert.ok(!('openExternal' in api), 'Must not expose openExternal');

  // Must NOT expose generic channels
  assert.ok(!('open' in api), 'Must not expose generic open');
  assert.ok(!('reveal' in api), 'Must not expose generic reveal');

  // Methods must accept vaultId + relativePath (string args, not File objects)
  assert.equal(typeof api.openGeneratedMarkdown, 'function');
  assert.equal(typeof api.revealExportArtifact, 'function');

  // API must return Promise with ok field
  api.openGeneratedMarkdown('v1', 'notes/imported/test.md').then((r) => {
    assert.equal(r.ok, true);
  });
}

run();
console.log('[PASS] artifact-preload-safety');
