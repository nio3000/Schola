/**
 * Phase 3-1-B: ImportJobManager in-memory lifecycle test.
 *
 * Tests the import job manager's create, update, cancel, and list
 * functionality.  Verifies that job status never contains sourcePath
 * or absolute paths.
 *
 * ⚠️  Uses the real import-job.manager module (no Python/MarkItDown runtime).
 */

import assert from 'node:assert/strict';
import {
  createJob,
  getJob,
  listJobs,
  updatePhase,
  updateProgress,
  updatePaths,
  cancelJob,
  clearAll,
} from '../../electron/services/import-job.manager';

function run(): void {
  clearAll();

  // ── Create job ────────────────────────────────
  const job = createJob({
    vaultId: 'test-vault',
    engine: 'markitdown',
    sourceFormat: 'pdf',
    sourceFileName: 'paper.pdf',
  });

  assert.ok(job.jobId.length > 0, 'Job must have an ID');
  assert.equal(job.vaultId, 'test-vault');
  assert.equal(job.phase, 'pending');
  assert.equal(job.engine, 'markitdown');
  assert.equal(job.sourceFormat, 'pdf');
  assert.equal(job.sourceFileName, 'paper.pdf');
  assert.equal(job.progress, 0);
  assert.equal(job.warnings.length, 0);
  assert.equal(job.error, null);
  assert.equal(job.outputMarkdownRelativePath, null);
  assert.equal(job.companionRelativePath, null);

  // sourceFileName must not be a path
  assert.ok(!job.sourceFileName.includes('\\'), 'sourceFileName must not be a Windows path');
  assert.ok(!job.sourceFileName.includes('/'), 'sourceFileName must not be a Unix path');

  // Verify job is retrievable
  const retrieved = getJob(job.jobId);
  assert.ok(retrieved !== null, 'Job must be retrievable');
  assert.equal(retrieved!.jobId, job.jobId);

  // ── Phase transitions ─────────────────────────
  updatePhase(job.jobId, 'copying');
  assert.equal(getJob(job.jobId)!.phase, 'copying');

  updatePhase(job.jobId, 'converting');
  assert.equal(getJob(job.jobId)!.phase, 'converting');

  updatePhase(job.jobId, 'completed');
  assert.equal(getJob(job.jobId)!.phase, 'completed');
  assert.ok(getJob(job.jobId)!.completedAt !== null, 'Completed job must have completedAt');

  // ── Progress tracking ─────────────────────────
  const job2 = createJob({
    vaultId: 'test-vault',
    engine: 'markitdown',
    sourceFormat: 'docx',
    sourceFileName: 'report.docx',
  });

  updateProgress(job2.jobId, 0.5);
  assert.equal(getJob(job2.jobId)!.progress, 0.5);

  updateProgress(job2.jobId, 1.5); // clamped to 1
  assert.equal(getJob(job2.jobId)!.progress, 1);

  updateProgress(job2.jobId, -0.5); // clamped to 0
  assert.equal(getJob(job2.jobId)!.progress, 0);

  // ── Path updates ──────────────────────────────
  updatePaths(job2.jobId, {
    attachmentRelativePath: 'attachments/imports/2026/05/import_002/original.docx',
    outputMarkdownRelativePath: 'notes/imported/report.md',
    companionRelativePath: '.schola/metadata/imports/import_002.json',
  });

  const updated = getJob(job2.jobId)!;
  assert.ok(updated.attachmentRelativePath.startsWith('attachments/'));
  assert.ok(updated.outputMarkdownRelativePath!.startsWith('notes/'));
  assert.ok(updated.companionRelativePath!.startsWith('.schola/'));

  // Verify no absolute paths
  assert.ok(!updated.attachmentRelativePath.includes(':\\'), 'Must be vault-relative');
  assert.ok(!updated.outputMarkdownRelativePath!.includes(':\\'), 'Must be vault-relative');
  assert.ok(!updated.companionRelativePath!.includes(':\\'), 'Must be vault-relative');

  // ── Cancel job ────────────────────────────────
  const job3 = createJob({
    vaultId: 'test-vault',
    engine: 'markitdown',
    sourceFormat: 'pdf',
    sourceFileName: 'slides.pdf',
  });

  updatePhase(job3.jobId, 'copying');
  const cancelled = cancelJob(job3.jobId);
  assert.ok(cancelled !== null);
  assert.equal(cancelled!.phase, 'cancelled');
  assert.ok(cancelled!.error !== null);
  assert.equal(cancelled!.error!.code, 'CANCELLED');

  // Cancel on completed job: should return as-is
  const alreadyCancelled = cancelJob(job3.jobId);
  assert.ok(alreadyCancelled !== null);
  assert.equal(alreadyCancelled!.phase, 'cancelled');

  // ── List jobs ─────────────────────────────────
  const all = listJobs('test-vault');
  assert.ok(all.length >= 3, 'Should list at least 3 jobs');

  // ── List jobs for non-existent vault ──────────
  const empty = listJobs('nonexistent-vault');
  assert.equal(empty.length, 0);

  // ── Non-existent job ──────────────────────────
  assert.equal(getJob('nonexistent-job'), null);
  assert.equal(cancelJob('nonexistent-job'), null);

  // ── Job status never exposes sourcePath ───────
  for (const j of all) {
    assert.ok(!('sourcePath' in j), `Job ${j.jobId} must not expose sourcePath`);
    assert.ok(!('absolutePath' in j), `Job ${j.jobId} must not expose absolutePath`);
  }

  clearAll();
}

run();
console.log('[PASS] import-job-manager');
