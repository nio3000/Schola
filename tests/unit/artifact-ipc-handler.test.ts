/**
 * Phase 3-3 C4: Artifact IPC handler path validation test.
 *
 * Tests validateGeneratedMarkdownPath and validateExportArtifactPath
 * against a real temp vault directory.  Verifies that only paths
 * within allowed roots and with allowed extensions pass validation.
 *
 * Does NOT invoke Electron shell — tests only the validation gate.
 */

import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import {
  validateGeneratedMarkdownPath,
  validateExportArtifactPath,
} from '../../electron/services/artifact-open.service';

async function run(): Promise<void> {
  const vaultRoot = path.join(os.tmpdir(), 'schola-artifact-test-' + Date.now());
  await mkdir(vaultRoot, { recursive: true });

  // Override env so getVaultRootPath can find this vault
  const originalEnv = process.env.SCHOLA_TEST_VAULT_PATH;
  process.env.SCHOLA_TEST_VAULT_PATH = vaultRoot;

  try {
    // ═══ Create test directories and files ═══
    await mkdir(path.join(vaultRoot, 'notes', 'imported'), { recursive: true });
    await mkdir(path.join(vaultRoot, '_exports'), { recursive: true });

    const generatedMd = 'notes/imported/paper.md';
    const exportDocx = '_exports/test_job_paper.docx';
    const exportPdf = '_exports/test_job_paper.pdf';

    await writeFile(path.join(vaultRoot, generatedMd), '# Test', 'utf-8');
    await writeFile(path.join(vaultRoot, exportDocx), 'dummy', 'utf-8');
    await writeFile(path.join(vaultRoot, exportPdf), 'dummy', 'utf-8');

    // Open vault to register it
    const { openVaultByPath } = await import('../../electron/services/vault.service');
    let vaultId: string;
    try {
      const info = await openVaultByPath(vaultRoot);
      vaultId = info.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // If vault already opened by previous test run, skip
      vaultId = Buffer.from(vaultRoot).toString('base64url');
    }

    // ═══ GENERATED MARKDOWN: valid ═══
    {
      const r = validateGeneratedMarkdownPath(vaultId, generatedMd);
      assert.equal(typeof r, 'string', 'Valid generated markdown must pass');
      assert.ok((r as string).startsWith(vaultRoot), 'Must resolve to vault absolute path');
    }

    // ═══ GENERATED MARKDOWN: wrong root ═══
    {
      const r = validateGeneratedMarkdownPath(vaultId, 'notes/private.md');
      assert.ok(typeof r !== 'string', 'notes/private.md must be rejected');
      assert.equal((r as { errorCode: string }).errorCode, 'OUTSIDE_ALLOWED_ROOT');
    }

    // ═══ GENERATED MARKDOWN: wrong extension ═══
    {
      const r = validateGeneratedMarkdownPath(vaultId, 'notes/imported/paper.pdf');
      assert.ok(typeof r !== 'string', 'Must reject non-.md in notes/imported/');
      assert.equal((r as { errorCode: string }).errorCode, 'UNSUPPORTED_EXTENSION');
    }

    // ═══ GENERATED MARKDOWN: outside vault ═══
    {
      const r = validateGeneratedMarkdownPath(vaultId, '../escape.md');
      assert.ok(typeof r !== 'string', 'Path traversal must be rejected');
      assert.equal((r as { errorCode: string }).errorCode, 'INVALID_PATH');
    }

    // ═══ GENERATED MARKDOWN: absolute path ═══
    {
      const r = validateGeneratedMarkdownPath(vaultId, '/etc/passwd');
      assert.ok(typeof r !== 'string', 'Absolute path must be rejected');
    }
    {
      const r = validateGeneratedMarkdownPath(vaultId, 'C:\\Windows\\file.md');
      assert.ok(typeof r !== 'string', 'Windows absolute path must be rejected');
    }

    // ═══ GENERATED MARKDOWN: URL ═══
    {
      const r = validateGeneratedMarkdownPath(vaultId, 'https://example.com/a.md');
      assert.ok(typeof r !== 'string', 'URL must be rejected');
    }

    // ═══ EXPORT ARTIFACT: valid ═══
    {
      const r = validateExportArtifactPath(vaultId, exportDocx);
      assert.equal(typeof r, 'string', 'Valid export .docx must pass');
    }
    {
      const r = validateExportArtifactPath(vaultId, exportPdf);
      assert.equal(typeof r, 'string', 'Valid export .pdf must pass');
    }

    // ═══ EXPORT ARTIFACT: wrong root ═══
    {
      const r = validateExportArtifactPath(vaultId, 'notes/imported/paper.md');
      assert.ok(typeof r !== 'string', 'notes/ path must be rejected for export');
      assert.equal((r as { errorCode: string }).errorCode, 'OUTSIDE_ALLOWED_ROOT');
    }

    // ═══ EXPORT ARTIFACT: wrong extension ═══
    {
      const r = validateExportArtifactPath(vaultId, '_exports/test_job_malware.exe');
      assert.ok(typeof r !== 'string', 'Must reject .exe');
      assert.equal((r as { errorCode: string }).errorCode, 'UNSUPPORTED_EXTENSION');
    }
    {
      const r = validateExportArtifactPath(vaultId, '_exports/test_job_output.md');
      assert.ok(typeof r !== 'string', 'Must reject .md in _exports/');
    }

    // ═══ EXPORT ARTIFACT: subdirectory nesting rejected ═══
    {
      const r = validateExportArtifactPath(vaultId, '_exports/2026/05/test/output.docx');
      assert.ok(typeof r !== 'string', 'Must reject subdirectories under _exports/');
      assert.equal((r as { errorCode: string }).errorCode, 'OUTSIDE_ALLOWED_ROOT');
    }

    // ═══ EXPORT ARTIFACT: path traversal ═══
    {
      const r = validateExportArtifactPath(vaultId, '_exports/../../notes/secret.md');
      assert.ok(typeof r !== 'string', 'Path traversal must be rejected');
    }

    // ═══ EXPORT ARTIFACT: absolute path ═══
    {
      const r = validateExportArtifactPath(vaultId, '/tmp/output.pdf');
      assert.ok(typeof r !== 'string', 'Absolute path must be rejected');
    }

    // ═══ ERROR MESSAGE SANITIZATION ═══
    // All error messages must NOT contain system absolute paths
    const errorCases: { fn: (v: string, p: unknown) => string | object; path: string }[] = [
      { fn: validateGeneratedMarkdownPath, path: 'notes/private.md' },
      { fn: validateExportArtifactPath, path: '_exports/test.exe' },
      { fn: validateGeneratedMarkdownPath, path: '/etc/passwd' },
    ];

    for (const { fn, path: p } of errorCases) {
      const result = fn(vaultId, p);
      if (typeof result !== 'string' && 'message' in result) {
        const msg = (result as { message: string }).message;
        assert.ok(!msg.includes(':\\'), 'Error message must not contain Windows path: ' + msg);
        assert.ok(!msg.includes('/etc/'), 'Error message must not contain Unix path: ' + msg);
        assert.ok(!msg.includes(vaultRoot), 'Error message must not contain vault root');
      }
    }
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
    process.env.SCHOLA_TEST_VAULT_PATH = originalEnv;
  }
}

run().then(() => {
  console.log('[PASS] artifact-ipc-handler');
}).catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
