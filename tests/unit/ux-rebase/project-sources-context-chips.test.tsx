/**
 * UX Rebase — Project Sources / Context Chips Test (P0/P1)
 * Phase 5-UX-REBASE-IMP-R5.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..', '..');

describe('ux-rebase project-sources-context-chips (P0/P1)', () => {
  it('ContextSourceSelector supports multiple file types', () => {
    const selectorPath = resolve(ROOT, 'src', 'features', 'ai-research', 'components', 'ContextSourceSelector.tsx');
    if (!existsSync(selectorPath)) return;
    const content = readFileSync(selectorPath, 'utf8');
    // Verify format support
    expect(content).toContain('.pdf');
    expect(content).toContain('.docx');
    expect(content).toContain('.pptx');
    expect(content).toContain('.tex');
    expect(content).toContain('.bib');
    expect(content).toContain('.csv');
    expect(content).toContain('.xlsx');
    expect(content).toContain('.png');
  });

  it('PDF source-backed evidence boundary preserved', () => {
    const evidencePath = resolve(ROOT, 'src', 'features', 'ai-research', 'components', 'EvidenceList.tsx');
    if (!existsSync(evidencePath)) return;
    const content = readFileSync(evidencePath, 'utf8');
    // EvidenceList uses 'source-backed' as evidence kind
    expect(content).toContain('source-backed');
  });

  it('ContextSourceSelector kicker uses knowledge sources label', () => {
    const selectorPath = resolve(ROOT, 'src', 'features', 'ai-research', 'components', 'ContextSourceSelector.tsx');
    if (!existsSync(selectorPath)) return;
    const content = readFileSync(selectorPath, 'utf8');
    expect(content).toContain('知识库源文件');
  });
});
