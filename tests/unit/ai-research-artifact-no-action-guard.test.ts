import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf-8');
}

describe('AI Research Artifact No-Action Guard', () => {
  it('AI-C-ARTIFACT-001/002 provider response only creates in-memory draft', () => {
    const gateway = readSource('electron/services/ai-provider-gateway.service.ts');
    const task = readSource('electron/services/ai-research-task.service.ts');

    expect(gateway).toContain('buildArtifactFromResponse');
    expect(task).toContain('artifacts.set');
    expect(gateway).not.toMatch(/writeFile|saveNote|resolveVaultPath/);
  });

  it('AI-C-ARTIFACT-003 save requires user-facing save button', () => {
    const preview = readSource('src/features/ai-research/components/ArtifactDraftPreview.tsx');
    const mainView = readSource('src/features/ai-research/AIResearchMainView.tsx');

    expect(preview).toContain('artifact-save-btn');
    expect(mainView).toContain('setShowSaveDialog(true)');
    expect(mainView).toContain('ArtifactSaveDialog');
  });

  it('AI-C-ARTIFACT-004 save before write requires confirmation dialog', () => {
    const dialog = readSource('src/features/ai-research/components/ArtifactSaveDialog.tsx');

    expect(dialog).toContain('artifact-save-dialog');
    expect(dialog).toContain('artifact-save-confirm-btn');
    expect(dialog).toContain('overwriteConfirmed');
  });

  it('AI-C-ARTIFACT-016/017 discard and save cancel do not call save IPC', () => {
    const mainView = readSource('src/features/ai-research/AIResearchMainView.tsx');
    const dialog = readSource('src/features/ai-research/components/ArtifactSaveDialog.tsx');

    expect(mainView).toContain('discardCurrentArtifact');
    expect(dialog).toContain('artifact-save-cancel-btn');
    expect(dialog).not.toContain('saveArtifactDraft');
  });

  it('AI-C-ARTIFACT-019 open/reveal reuse fixed-function artifact APIs', () => {
    const mainView = readSource('src/features/ai-research/AIResearchMainView.tsx');

    expect(mainView).toContain('openGeneratedMarkdown');
    expect(mainView).toContain('revealGeneratedMarkdown');
    expect(mainView).not.toContain('shell.open');
  });

  it('AI-C-ARTIFACT-020 no generic file write IPC is introduced', () => {
    const contracts = readSource('src/lib/contracts/ai-research.types.ts');
    const preload = readSource('electron/preload.ts');
    const ipc = readSource('electron/ipc/ai-research.ipc.ts');

    expect(contracts).not.toContain('file:write');
    expect(preload).not.toContain('file:write');
    expect(ipc).not.toContain('file:write');
    expect(contracts).toContain('ai-research:save-artifact-draft');
  });
});
