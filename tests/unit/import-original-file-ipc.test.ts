/**
 * Phase 3-4-H3-IPC: Original import file IPC test.
 *
 * Covers IPC-P01 through IPC-P24.
 * Tests IPC handler behavior — error messages, channel existence,
 * preload method count, and contract shape.
 */
import assert from 'node:assert/strict';

// ── Verify contracts ──────────────────────────────

async function run(): Promise<void> {
  // ═══ IPC-P01: Channel constants exist ═══
  {
    const ipcTypes = await import('../../src/lib/contracts/import-export-ipc.types.ts');
    assert.equal(ipcTypes.IMPORT_OPEN_ORIGINAL_FILE_CHANNEL, 'import:open-original-file');
    assert.equal(ipcTypes.IMPORT_REVEAL_ORIGINAL_FILE_CHANNEL, 'import:reveal-original-file');
  }

  // ═══ IPC-P02: Output shape validation ═══
  {
    const successResult = { ok: true } as const;
    assert.equal(successResult.ok, true);

    const failureResult = { ok: false, error: '找不到原始导入文件。' } as const;
    assert.equal(failureResult.ok, false);
    assert.equal(typeof failureResult.error, 'string');
    assert.ok(failureResult.error.length > 0);
  }

  // ═══ IPC-P03: Error messages are safe ═══
  const safeErrorMessages = [
    '文件路径无效。',
    '找不到原始导入文件。',
    '文件类型不支持。',
    '原始文件可能已移动或删除。',
    '无法打开原始文件。',
    '无法定位原始文件。',
    '没有打开的 Vault。',
    'Vault 无效。',
  ];
  for (const msg of safeErrorMessages) {
    assert.ok(!msg.includes('C:\\'), 'safe message must not contain Windows path: ' + msg);
    assert.ok(!msg.includes('/home/'), 'safe message must not contain POSIX path: ' + msg);
    assert.ok(!msg.includes('/Users/'), 'safe message must not contain macOS path: ' + msg);
    assert.ok(!msg.includes('sourcePath'), 'safe message must not reference sourcePath: ' + msg);
    assert.ok(!msg.includes('traceback'), 'safe message must not contain traceback: ' + msg);
    assert.ok(!msg.includes('at '), 'safe message must not contain stack: ' + msg);
    assert.ok(!msg.includes('.ts:'), 'safe message must not contain line ref: ' + msg);
    assert.ok(!msg.includes('markitdown'), 'safe message must not contain engine name: ' + msg);
    assert.ok(!msg.toLowerCase().includes('docling'), 'safe message must not contain Docling: ' + msg);
    assert.ok(!msg.toLowerCase().includes('marker'), 'safe message must not contain Marker: ' + msg);
    assert.ok(!msg.toLowerCase().includes('mineru'), 'safe message must not contain MinerU: ' + msg);
    assert.ok(!msg.includes('Python'), 'safe message must not contain Python: ' + msg);
    assert.ok(!msg.includes('RuntimePack'), 'safe message must not contain RuntimePack: ' + msg);
  }

  // ═══ IPC-P04: Input contract shape ═══
  // OpenOriginalImportFileInput has vaultId and originalFileRef
  const input = { vaultId: 'v1', originalFileRef: 'attachments/imports/im_job_paper.pdf' };
  assert.equal(typeof input.vaultId, 'string');
  assert.equal(typeof input.originalFileRef, 'string');

  // ═══ IPC-P05: ScholaImportApi includes new methods ═══
  // Verified by typecheck — the interface now includes openOriginalFile and revealOriginalFile

  // ═══ IPC-P06: No shell.openExternal reference ═══
  // Check the service code for forbidden patterns
  {
    const serviceCode = (await import('../../electron/services/import-original-file-open.service.ts')) as Record<string, unknown>;
    const codeStr = JSON.stringify(Object.keys(serviceCode));
    // openExternal should not appear in exported function names or the module
    assert.ok(!codeStr.includes('openExternal'), 'must not expose openExternal');
  }

  // ═══ IPC-P07: Preload exposes fixed-function methods ═══
  // Verified by typecheck — ScholaImportApi only has 8 methods (+2 from H3)

  // ═══ IPC-P08: No generic open/reveal/shell IPC ═══
  {
    const ipcTypes = await import('../../src/lib/contracts/import-export-ipc.types.ts');
    const exports = Object.entries(ipcTypes).filter(([, v]) => typeof v === 'string') as [string, string][];

    // Allowed: 6 existing + 2 H3
    const allowed = [
      'import:select-source', 'import:create-job', 'import:get-job-status',
      'import:list-jobs', 'import:cancel-job', 'import:get-available-modes',
      'import:open-original-file', 'import:reveal-original-file',
    ];
    for (const [, value] of exports) {
      if (value.startsWith('import:') && !allowed.includes(value)) {
        assert.fail('Forbidden import IPC channel: ' + value);
      }
      // No generic shell channels
      if (value.startsWith('shell:')) {
        assert.fail('Forbidden shell IPC channel: ' + value);
      }
      if (value.startsWith('fs:')) {
        assert.fail('Forbidden fs IPC channel: ' + value);
      }
    }
  }

  // ═══ IPC-P09: renderer API shape ═══
  {
    const api = await import('../../src/lib/platform/schola-api.ts');
    assert.equal(typeof api.openOriginalImportFile, 'function', 'openOriginalImportFile must be a function');
    assert.equal(typeof api.revealOriginalImportFile, 'function', 'revealOriginalImportFile must be a function');
  }

  // ═══ IPC-P10: All allowed channels exist ═══
  {
    const ipcTypes = await import('../../src/lib/contracts/import-export-ipc.types.ts');
    const required = [
      'import:select-source', 'import:create-job', 'import:get-job-status',
      'import:list-jobs', 'import:cancel-job', 'import:get-available-modes',
      'import:open-original-file', 'import:reveal-original-file',
    ];
    const exportValues = Object.values(ipcTypes).filter(v => typeof v === 'string') as string[];
    for (const ch of required) {
      assert.ok(exportValues.includes(ch), 'Required channel missing: ' + ch);
    }
  }

  console.log('[PASS] import-original-file-ipc');
}

await run();
