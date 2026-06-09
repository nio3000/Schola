/**
 * Phase 3-1-C: ExportJobManager in-memory lifecycle test.
 *
 * Tests the export job manager's create, update, cancel, and list.
 * Verifies status never contains absolute paths.
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
} from '../../electron/services/export-job.manager';

function run(): void {
  clearAll();

  const job = createJob({
    vaultId: 'test-vault',
    engine: 'pandoc',
    targetFormat: 'docx',
    sourceMarkdownRelativePath: 'notes/paper.md',
  });

  assert.ok(job.jobId.length > 0);
  assert.equal(job.phase, 'pending');
  assert.equal(job.engine, 'pandoc');
  assert.equal(job.targetFormat, 'docx');
  assert.equal(job.sourceMarkdownRelativePath, 'notes/paper.md');
  assert.equal(job.outputRelativePath, null);
  assert.equal(job.metadataRelativePath, null);
  assert.equal(job.progress, 0);

  // Phase transitions
  updatePhase(job.jobId, 'converting');
  assert.equal(getJob(job.jobId)!.phase, 'converting');
  updatePhase(job.jobId, 'completed');
  assert.equal(getJob(job.jobId)!.phase, 'completed');
  assert.ok(getJob(job.jobId)!.completedAt !== null);

  // Progress
  const j2 = createJob({
    vaultId: 'test-vault',
    engine: 'pandoc',
    targetFormat: 'pdf',
    sourceMarkdownRelativePath: 'notes/slides.md',
  });
  updateProgress(j2.jobId, 0.75);
  assert.equal(getJob(j2.jobId)!.progress, 0.75);

  // Paths must be vault-relative
  const j3 = createJob({
    vaultId: 'test-vault',
    engine: 'pandoc',
    targetFormat: 'html',
    sourceMarkdownRelativePath: 'notes/post.md',
  });
  updatePaths(j3.jobId, {
    outputRelativePath: '_exports/2026/05/export_003/output.html',
    metadataRelativePath: '.schola/metadata/exports/export_003.json',
  });
  const updated = getJob(j3.jobId)!;
  assert.ok(updated.outputRelativePath!.startsWith('_exports/'));
  assert.ok(updated.metadataRelativePath!.startsWith('.schola/'));
  assert.ok(!updated.outputRelativePath!.includes(':\\'));

  // Cancel
  cancelJob(j3.jobId);
  assert.equal(getJob(j3.jobId)!.phase, 'cancelled');

  // List
  const all = listJobs('test-vault');
  assert.ok(all.length >= 2);

  // No sourcePath in status
  for (const s of all) {
    assert.ok(!('sourcePath' in s), 'Must not expose sourcePath');
    assert.ok(!('absolutePath' in s), 'Must not expose absolutePath');
  }

  clearAll();
}

run();
console.log('[PASS] export-job-manager');
