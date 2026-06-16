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

function makeArtifact(content = 'Draft body'): AIArtifactDraft {
  return {
    id: 'artifact-task-1',
    artifactId: 'artifact-task-1',
    taskId: 'task-1',
    taskType: 'analysis_summary',
    title: '文献分析草稿',
    format: 'markdown',
    content,
    evidence: [
      {
        id: 'ev-1',
        kind: 'source-backed',
        label: '上下文来源',
        relativePath: 'notes/research.md',
        displayName: 'research.md',
        sourceType: 'markdown',
        quotePreview: 'Selected quote',
        confidence: 'high',
        note: 'Context source',
        sourceRef: { relativePath: 'notes/research.md', displayName: 'research.md' },
      },
      {
        id: 'ev-2',
        kind: 'model-inferred',
        label: '模型综合推断',
        confidence: 'medium',
        modelInferredNote: '本段为模型综合推断，需人工核验。',
      },
    ],
    evidenceRefs: [],
    warnings: [],
    isDraft: true,
    reviewRequired: true,
    createdAt: '2026-06-16T00:00:00.000Z',
    updatedAt: '2026-06-16T00:00:00.000Z',
    sourcePackId: 'pack-1',
    providerId: 'ollama',
    model: 'llama3.2',
    skillId: 'paper-reading',
    status: 'draft',
  };
}

describe('AI Research Artifact Draft Save', () => {
  let rootPath: string;

  beforeEach(async () => {
    rootPath = await fs.mkdtemp(path.join(os.tmpdir(), 'schola-artifact-save-'));
    const artifact = makeArtifact();
    mocks.getVaultRootPath.mockReturnValue(rootPath);
    mocks.getArtifactDraft.mockReturnValue(artifact);
    mocks.markArtifactDraftSaved.mockImplementation((artifactId: string, relativePath: string) => ({
      ...artifact,
      artifactId,
      status: 'saved',
      savedRelativePath: relativePath,
    }));
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await fs.rm(rootPath, { recursive: true, force: true });
  });

  it('AI-C-ARTIFACT-005 saves markdown inside the Vault after explicit call', async () => {
    const { saveArtifactDraft } = await import('../../electron/services/ai-artifact-draft.service');

    const result = await saveArtifactDraft({
      vaultId: 'vault-1',
      artifactId: 'artifact-task-1',
      targetRelativePath: '_ai_drafts/result.md',
    });

    expect(result.relativePath).toBe('_ai_drafts/result.md');
    const saved = await fs.readFile(path.join(rootPath, '_ai_drafts', 'result.md'), 'utf-8');
    expect(saved).toContain('# 文献分析草稿');
    expect(saved).toContain('## Evidence');
    expect(saved).toContain('AI 生成内容需人工核验');
  });

  it('AI-C-ARTIFACT-012/013 sanitizes API keys and Authorization headers in saved markdown', async () => {
    const artifact = makeArtifact(
      'Draft sk-test-secret-12345678901234567890 Authorization: Bearer raw-token',
    );
    mocks.getArtifactDraft.mockReturnValue(artifact);
    const { saveArtifactDraft } = await import('../../electron/services/ai-artifact-draft.service');

    await saveArtifactDraft({
      vaultId: 'vault-1',
      artifactId: artifact.artifactId,
      targetRelativePath: '_ai_drafts/safe.md',
    });

    const saved = await fs.readFile(path.join(rootPath, '_ai_drafts', 'safe.md'), 'utf-8');
    expect(saved).not.toContain('sk-test-secret');
    expect(saved).not.toContain('raw-token');
    expect(saved).toContain('[REDACTED]');
  });

  it('AI-C-ARTIFACT-015 requires overwrite confirmation', async () => {
    const { saveArtifactDraft } = await import('../../electron/services/ai-artifact-draft.service');
    await fs.mkdir(path.join(rootPath, '_ai_drafts'), { recursive: true });
    await fs.writeFile(path.join(rootPath, '_ai_drafts', 'result.md'), 'existing', 'utf-8');

    await expect(
      saveArtifactDraft({
        vaultId: 'vault-1',
        artifactId: 'artifact-task-1',
        targetRelativePath: '_ai_drafts/result.md',
      }),
    ).rejects.toThrow(/OVERWRITE_CONFIRMATION_REQUIRED/);
  });

  it('AI-C-ARTIFACT-018 returns only Vault relative path', async () => {
    const { saveArtifactDraft } = await import('../../electron/services/ai-artifact-draft.service');
    const result = await saveArtifactDraft({
      vaultId: 'vault-1',
      artifactId: 'artifact-task-1',
      targetRelativePath: '_ai_drafts/result.md',
    });

    expect(result.relativePath).toBe('_ai_drafts/result.md');
    expect(JSON.stringify(result)).not.toContain(rootPath);
  });
});
