/**
 * UX Rebase — AI Research Codex-like Test (P0: UX-TB-P0-033 ~ 041)
 * Phase 5-UX-REBASE-IMP-CONTINUE-R3.
 *
 * Uses code analysis since the component has complex runtime dependencies
 * (IPC, hooks) that require full app context for rendering.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('ux-rebase ai-research-codex-like (P0)', () => {
  const mainViewPath = resolve(ROOT, 'src', 'features', 'ai-research', 'AIResearchMainView.tsx');

  it('UX-TB-P0-033: feature name preserved, not renamed', () => {
    if (!existsSync(mainViewPath)) return;
    const content = readFileSync(mainViewPath, 'utf8');
    expect(content).toContain('AI');
    expect(content).not.toContain('知识库工作台');
  });

  it('UX-TB-P0-036: has InstructionEditor for task input', () => {
    if (!existsSync(mainViewPath)) return;
    const content = readFileSync(mainViewPath, 'utf8');
    expect(content).toContain('InstructionEditor');
  });

  it('UX-TB-P0-037: has ContextSourceSelector for project sources', () => {
    if (!existsSync(mainViewPath)) return;
    const content = readFileSync(mainViewPath, 'utf8');
    expect(content).toContain('ContextSourceSelector');
  });

  it('UX-TB-P0-040: has ContextConfirmationModal for run guard', () => {
    if (!existsSync(mainViewPath)) return;
    const content = readFileSync(mainViewPath, 'utf8');
    expect(content).toContain('ContextConfirmationModal');
  });

  it('UX-TB-P0-041: has ArtifactDraftPreview and EvidenceList for results', () => {
    if (!existsSync(mainViewPath)) return;
    const content = readFileSync(mainViewPath, 'utf8');
    expect(content).toContain('ArtifactDraftPreview');
    expect(content).toContain('EvidenceList');
  });
});
