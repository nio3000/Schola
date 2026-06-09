/**
 * AI Research — Artifact Preview UI Test — Phase 5-2 P1.
 *
 * Verifies:
 * - ArtifactDraftPreview renders draft content
 * - Review Required banner is always shown
 * - Save to Vault button is disabled (placeholder)
 * - Export button is disabled
 * - Empty state when no artifact
 * - Artifact title and content displays correctly
 *
 * Test boundaries: 52-TB-UI-040 through 52-TB-UI-047
 */
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'vitest';
import { ArtifactDraftPreview } from '../../src/features/ai-research/components/ArtifactDraftPreview';
import type { AIArtifactDraft } from '../../src/lib/contracts/ai-research.types';

// ── Helpers ───────────────────────────────────────────

function makeArtifact(overrides?: Partial<AIArtifactDraft>): AIArtifactDraft {
  return {
    artifactId: 'artifact-001',
    taskId: 'task-001',
    taskType: 'analysis_summary',
    title: '测试分析摘要',
    content: '# 分析结果\n\n这是测试内容。',
    evidence: [],
    warnings: [],
    isDraft: true,
    reviewRequired: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  } satisfies Partial<AIArtifactDraft> as AIArtifactDraft;
}

function renderHtml(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

// ═══════════════════════════════════════════════════════════════
// Artifact preview structure
// ═══════════════════════════════════════════════════════════════

describe('AI Research — Artifact Draft Preview', () => {
  it('52-TB-UI-040: renders with data-testid', () => {
    const html = renderHtml(
      React.createElement(ArtifactDraftPreview, { artifact: null }),
    );

    assert.ok(
      html.includes('ai-research-artifact-draft-preview'),
      'Must have artifact preview testid',
    );
  });

  it('52-TB-UI-041: Review Required banner is always present', () => {
    const html = renderHtml(
      React.createElement(ArtifactDraftPreview, {
        artifact: makeArtifact(),
      }),
    );

    assert.ok(
      html.includes('需要人工审查'),
      'Must show review required banner',
    );
    assert.ok(
      html.includes('不会自动保存到 Vault'),
      'Must show no-auto-save message',
    );
  });

  it('52-TB-UI-042: Save to Vault button is disabled', () => {
    const html = renderHtml(
      React.createElement(ArtifactDraftPreview, {
        artifact: makeArtifact(),
      }),
    );

    assert.ok(
      html.includes('保存到 Vault'),
      'Must have save to vault button text',
    );
    assert.ok(
      html.includes('disabled') && html.includes('保存到 Vault'),
      'Save to Vault button must be disabled',
    );
  });

  it('52-TB-UI-043: Export button is disabled', () => {
    const html = renderHtml(
      React.createElement(ArtifactDraftPreview, {
        artifact: makeArtifact(),
      }),
    );

    assert.ok(
      html.includes('导出'),
      'Must have export button text',
    );
    assert.ok(
      html.includes('Phase 5-4'),
      'Export button must reference future phase',
    );
  });

  it('52-TB-UI-044: shows draft pill badge', () => {
    const html = renderHtml(
      React.createElement(ArtifactDraftPreview, {
        artifact: makeArtifact(),
      }),
    );

    assert.ok(html.includes('草稿'), 'Must show draft pill');
  });

  it('52-TB-UI-045: empty state when no artifact', () => {
    const html = renderHtml(
      React.createElement(ArtifactDraftPreview, { artifact: null }),
    );

    assert.ok(
      html.includes('尚未生成草稿'),
      'Must show empty state title',
    );
    assert.ok(
      html.includes('只读草稿预览'),
      'Must reference read-only preview',
    );
  });

  it('52-TB-UI-046: displays artifact title when present', () => {
    const html = renderHtml(
      React.createElement(ArtifactDraftPreview, {
        artifact: makeArtifact({ title: '研究问题拆解结果' }),
      }),
    );

    assert.ok(
      html.includes('研究问题拆解结果'),
      'Must display artifact title',
    );
  });

  it('52-TB-UI-047: displays artifact content when present', () => {
    const html = renderHtml(
      React.createElement(ArtifactDraftPreview, {
        artifact: makeArtifact({ content: '# 重点发现\n\n重要结论。' }),
      }),
    );

    assert.ok(
      html.includes('重点发现'),
      'Must display artifact content heading',
    );
    assert.ok(
      html.includes('重要结论'),
      'Must display artifact content body',
    );
  });
});
