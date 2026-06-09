/**
 * Phase 3-4-B / Phase 3-4-H3: Boundary test — no UI / IPC additions.
 *
 * Asserts no import:list-engines, import:set-engine, import:list-modes,
 * shell:open, shell:reveal, import:run-python, import:open-path, or
 * generic open/reveal IPC channels exist.
 *
 * Phase 3-4-H3: allows import:open-original-file and import:reveal-original-file
 * as fixed-function additions.
 */
import assert from 'node:assert/strict';

async function run(): Promise<void> {
  // Import the actual contract to check (dynamic import for ESM)
  const ipcTypes = await import('../../src/lib/contracts/import-export-ipc.types.ts');
  const allExports: string[] = Object.keys(ipcTypes);

  // ═══ Forbidden IPC channels ═══
  const forbiddenChannels = [
    'import:list-engines',
    'import:set-engine',
    'import:list-modes',
    'import:run-python',
    'import:run-runtime',
    'import:open-path',
    'import:reveal-path',
    'shell:open',
    'shell:reveal',
    'shell:open-external-file',
    'shell:show-item',
    'fs:read',
    'fs:write',
  ];

  for (const forbidden of forbiddenChannels) {
    const found = allExports.some((k) =>
      typeof (ipcTypes as Record<string, unknown>)[k] === 'string' && (ipcTypes as Record<string, unknown>)[k] === forbidden,
    );
    assert.ok(!found, 'Forbidden IPC channel must not exist: ' + forbidden);
  }

  // ═══ Allowed import channels (Phase 3-4-H3 update) ═══
  const allowedChannels = [
    'import:select-source',
    'import:create-job',
    'import:get-job-status',
    'import:list-jobs',
    'import:cancel-job',
    'import:get-available-modes',
    'import:open-original-file',
    'import:reveal-original-file',
  ];
  for (const ch of allowedChannels) {
    const found = allExports.some((k) =>
      typeof (ipcTypes as Record<string, unknown>)[k] === 'string' && (ipcTypes as Record<string, unknown>)[k] === ch,
    );
    assert.ok(found, 'Allowed channel must exist: ' + ch);
  }

  console.log('[PASS] import-boundary-no-ui-ipc');
}

await run();
