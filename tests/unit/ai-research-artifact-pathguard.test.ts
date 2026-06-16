import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIArtifactDraft } from '../../src/lib/contracts/ai-research.types';

const mocks = vi.hoisted(() => ({
  getVaultRootPath: vi.fn(),
  getArtifactDraft: vi.fn(),
  markArtifactDraftSaved: vi.fn(),
}));

vi.mock('../../electron/services/vault.service', () => ({
  getVaultRootPath: mocks.getVaultRootPath,
}));

vi.mock('../../electron/services/ai-research-task.service', () => ({
  getArtifactDraft: mocks.getArtifactDraft,
  markArtifactDraftSaved: mocks.markArtifactDraftSaved,
}));

function artifact(): AIArtifactDraft {
  return {
    id: 'artifact-1',
    artifactId: 'artifact-1',
    taskId: 'task-1',
    taskType: 'analysis_summary',
    title: 'Draft',
    format: 'markdown',
    content: 'body',
    evidence: [],
    evidenceRefs: [],
    warnings: [],
    isDraft: true,
    reviewRequired: true,
    createdAt: '2026-06-16T00:00:00.000Z',
    updatedAt: '2026-06-16T00:00:00.000Z',
    sourcePackId: 'pack-1',
    providerId: 'ollama',
    model: 'llama3.2',
    skillId: 'skill-1',
    status: 'draft',
  };
}

describe('AI Research Artifact Save PathGuard', () => {
  let rootPath: string;

  beforeEach(async () => {
    rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'schola-artifact-pathguard-'));
    mocks.getVaultRootPath.mockReturnValue(rootPath);
    mocks.getArtifactDraft.mockReturnValue(artifact());
    mocks.markArtifactDraftSaved.mockImplementation((artifactId: string, relativePath: string) => ({
      ...artifact(),
      artifactId,
      status: 'saved',
      savedRelativePath: relativePath,
    }));
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await fs.rm(rootPath, { recursive: true, force: true });
  });

  it.each([
    ['AI-C-ARTIFACT-006 absolute Windows path', 'C:/Users/me/out.md'],
    ['AI-C-ARTIFACT-006 absolute POSIX path', '/tmp/out.md'],
    ['AI-C-ARTIFACT-007 traversal path', '../out.md'],
    ['AI-C-ARTIFACT-008 .schola path', '.schola/out.md'],
    ['AI-C-ARTIFACT-009 _trash path', '_trash/out.md'],
    ['AI-C-ARTIFACT-010 _exports path', '_exports/out.md'],
    ['AI-C-P0-019 hidden directory path', 'notes/.hidden/out.md'],
    ['AI-C-ARTIFACT-011 non-markdown extension', '_ai_drafts/out.txt'],
  ])('%s is blocked', async (_name, targetRelativePath) => {
    const { saveArtifactDraft } = await import('../../electron/services/ai-artifact-draft.service');

    await expect(
      saveArtifactDraft({
        vaultId: 'vault-1',
        artifactId: 'artifact-1',
        targetRelativePath,
      }),
    ).rejects.toThrow(/AI_ARTIFACT_SAVE_ERROR/);
  });

  it('AI-C-P0-019 blocks symlink parent escape by realpath validation', async () => {
    if (process.platform === 'win32') return;
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'schola-artifact-outside-'));
    await fs.symlink(outside, path.join(rootPath, 'linked-dir'), 'dir');
    const { saveArtifactDraft } = await import('../../electron/services/ai-artifact-draft.service');

    await expect(
      saveArtifactDraft({
        vaultId: 'vault-1',
        artifactId: 'artifact-1',
        targetRelativePath: 'linked-dir/out.md',
      }),
    ).rejects.toThrow(/AI_ARTIFACT_SAVE_ERROR/);

    await fs.rm(outside, { recursive: true, force: true });
  });
});
