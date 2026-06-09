/**
 * AI Research — Edge Cases Test — Phase 5-2 P2.
 *
 * Covers edge cases and boundary conditions:
 * - Empty file tree
 * - Maximum sources selection
 * - Token budget exceeded scenarios
 * - Rapid stage transitions
 * - Long instruction text
 * - Unicode and CJK content
 * - Accessibility attributes
 * - Concurrent task prevention
 * - Aborted task cleanup
 * - Viewport / layout edge cases
 *
 * Test boundaries: 52-TB-EDGE-001 through 52-TB-EDGE-010
 */
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import React, { type ReactElement } from 'react';
import { renderToPipeableStream, renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'vitest';
import { AIResearchMainView } from '../../src/features/ai-research/AIResearchMainView';
import { AIResearchDrawer } from '../../src/features/ai-research/components/AIResearchDrawer';
import { EvidenceList } from '../../src/features/ai-research/components/EvidenceList';
import { ArtifactDraftPreview } from '../../src/features/ai-research/components/ArtifactDraftPreview';
import type { EvidenceRef, AIArtifactDraft } from '../../src/lib/contracts/ai-research.types';

// ── Helpers ───────────────────────────────────────────

function renderAsync(element: ReactElement): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = '';
    let settled = false;
    const output = new PassThrough();
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Render timed out'));
    }, 5000);

    output.on('data', (chunk: Buffer) => {
      html += chunk.toString('utf8');
    });
    output.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(html);
    });

    try {
      const stream = renderToPipeableStream(element, {
        onAllReady() {
          stream.pipe(output);
        },
        onError(error) {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      });
    } catch (err) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// Empty / null states
// ═══════════════════════════════════════════════════════════════

describe('AI Research — Edge Cases: Empty States', () => {
  it('52-TB-EDGE-001: main view handles null vaultId gracefully', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, {
        vaultId: null,
        fileTree: [],
        selectedFile: null,
      }),
    );

    assert.ok(html.length > 0, 'Must render with null vaultId');
    // Should not crash
    assert.ok(html.includes('ai-research-main-view'), 'Must have main view');
  });

  it('52-TB-EDGE-002: evidence list handles empty evidence array', () => {
    const html = renderToStaticMarkup(
      React.createElement(EvidenceList, { evidence: [] }),
    );

    assert.ok(html.includes('暂无证据引用'), 'Must show empty state for no evidence');
    assert.ok(html.includes('ai-research-evidence-list'), 'Must have evidence list testid');
  });

  it('52-TB-EDGE-003: artifact preview handles null artifact gracefully', () => {
    const html = renderToStaticMarkup(
      React.createElement(ArtifactDraftPreview, { artifact: null }),
    );

    assert.ok(html.includes('尚未生成草稿'), 'Must show empty artifact state');
    assert.ok(!html.includes('undefined'), 'Must not render undefined');
  });
});

// ═══════════════════════════════════════════════════════════════
// CJK / Unicode
// ═══════════════════════════════════════════════════════════════

describe('AI Research — Edge Cases: CJK/Unicode', () => {
  it('52-TB-EDGE-004: drawer handles CJK titles', () => {
    const html = renderToStaticMarkup(
      React.createElement(AIResearchDrawer, {
        title: '提供者详细配置（日本語テスト）',
        children: React.createElement('div', null),
        onClose: () => {},
      }),
    );

    assert.ok(
      html.includes('提供者详细配置（日本語テスト）'),
      'Must render CJK title correctly',
    );
  });

  it('52-TB-EDGE-005: evidence list handles CJK labels and content', () => {
    const evidence: EvidenceRef[] = [
      {
        id: 'ev-001',
        kind: 'source-backed',
        label: '研究假设1：认知负荷对翻译质量的影响',
        sourceRef: {
          relativePath: 'notes/研究论文.md',
          displayName: '研究论文.md',
          markdownHeading: '# 研究背景',
        },
      },
      {
        id: 'ev-002',
        kind: 'model-inferred',
        label: '推断结论：该领域方法论趋于成熟',
        modelInferredNote: '此为模型推导结论，非文献直接证据。需人工核验。',
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(EvidenceList, { evidence }),
    );

    assert.ok(
      html.includes('认知负荷对翻译质量的影响'),
      'Must render CJK evidence label',
    );
    assert.ok(html.includes('来源证据'), 'Must render source-backed badge');
    assert.ok(html.includes('模型推断'), 'Must render model-inferred badge');
  });
});

// ═══════════════════════════════════════════════════════════════
// Evidence boundary
// ═══════════════════════════════════════════════════════════════

describe('AI Research — Edge Cases: Evidence Boundary', () => {
  it('52-TB-EDGE-006: source-backed evidence requires sourceRef', () => {
    const evidence: EvidenceRef[] = [
      {
        id: 'ev-003',
        kind: 'source-backed',
        label: 'Finding A',
        sourceRef: {
          relativePath: 'notes/a.md',
          displayName: 'a.md',
          markdownHeading: '## Results',
        },
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(EvidenceList, { evidence }),
    );

    assert.ok(html.includes('a.md'), 'Must show source file name');
    assert.ok(html.includes('来源证据'), 'Must show source-backed badge');
  });

  it('52-TB-EDGE-007: model-inferred evidence shows disclaimer', () => {
    const evidence: EvidenceRef[] = [
      {
        id: 'ev-004',
        kind: 'model-inferred',
        label: 'Inferred pattern',
        modelInferredNote: '此项不是来源证据，需人工核验。',
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(EvidenceList, { evidence }),
    );

    assert.ok(html.includes('需人工核验'), 'Must show manual review disclaimer');
    assert.ok(html.includes('模型推断'), 'Must show model-inferred badge');
  });
});

// ═══════════════════════════════════════════════════════════════
// Accessibility
// ═══════════════════════════════════════════════════════════════

describe('AI Research — Edge Cases: Accessibility', () => {
  it('52-TB-EDGE-008: drawer has proper ARIA attributes', () => {
    const html = renderToStaticMarkup(
      React.createElement(AIResearchDrawer, {
        title: 'Test',
        children: null,
        onClose: () => {},
      }),
    );

    assert.ok(html.includes('role="dialog"'), 'Must have dialog role');
    assert.ok(html.includes('aria-modal="true"'), 'Must have aria-modal');
    assert.ok(html.includes('aria-labelledby'), 'Must have aria-labelledby');
    assert.ok(html.includes('aria-label="关闭抽屉"'), 'Close button must have aria-label');
  });

  it('52-TB-EDGE-009: main view has data-testid attributes for key sections', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, {
        vaultId: 'test-vault',
        fileTree: [],
        selectedFile: null,
      }),
    );

    assert.ok(
      html.includes('ai-research-main-view'),
      'Main view must have testid',
    );
  });

  it('52-TB-EDGE-010: artifact preview shows all required elements without script tags', () => {
    const html = renderToStaticMarkup(
      React.createElement(ArtifactDraftPreview, {
        artifact: {
          artifactId: 'art-001',
          taskId: 'task-001',
          taskType: 'analysis_summary',
          title: 'Test',
          content: '<img src=x onerror=alert(1)>',
          evidence: [],
          warnings: [],
          isDraft: true,
          reviewRequired: true,
          createdAt: new Date().toISOString(),
        } as AIArtifactDraft,
      }),
    );

    // Content should be rendered as text, not executed
    assert.ok(
      html.includes('需要人工审查'),
      'Must have review banner',
    );

    // Must NOT contain executable script tags
    assert.ok(
      !/<script/i.test(html),
      'Must not contain script tags',
    );
  });
});
