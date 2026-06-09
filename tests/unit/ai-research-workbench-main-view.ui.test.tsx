/**
 * AI Research — Workbench Main View UI Test — Phase 5-2 P1.
 *
 * Verifies:
 * - AIResearchMainView renders three columns (left, center, right)
 * - Each column has expected components
 * - Stage labels are correct
 * - data-testid attributes are present
 * - Provider card context source selector
 * - Artifact draft preview in right column
 *
 * Test boundaries: 52-TB-UI-001 through 52-TB-UI-008
 */
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import React, { type ReactElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { describe, it } from 'vitest';
import { AIResearchMainView } from '../../src/features/ai-research/AIResearchMainView';

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

// ── Props ─────────────────────────────────────────────

function makeProps() {
  return {
    vaultId: null,
    fileTree: [],
    selectedFile: null,
  };
}

// ═══════════════════════════════════════════════════════════════
// Main View structure
// ═══════════════════════════════════════════════════════════════

describe('AI Research — Workbench Main View', () => {
  it('52-TB-UI-001: renders without crashing (smoke test)', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, makeProps()),
    );
    assert.ok(html.length > 0, 'Must render HTML');
    assert.ok(
      html.includes('ai-research-main-view'),
      'Must contain main view testid',
    );
  });

  it('52-TB-UI-002: renders three-column layout', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, makeProps()),
    );

    // Three columns should be present
    const leftColumn = html.includes('workspace-ai-research-column-left');
    const centerColumn = html.includes('workspace-ai-research-column-center');
    const rightColumn = html.includes('workspace-ai-research-column-right');

    assert.ok(leftColumn, 'Must have left column');
    assert.ok(centerColumn, 'Must have center column');
    assert.ok(rightColumn, 'Must have right column');
  });

  it('52-TB-UI-003: left column contains ProviderReadinessCard', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, makeProps()),
    );

    assert.ok(
      html.includes('提供者就绪度'),
      'Left column must contain ProviderReadinessCard',
    );
  });

  it('52-TB-UI-004: left column contains ContextSourceSelector', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, makeProps()),
    );

    assert.ok(
      html.includes('知识库源文件'),
      'Left column must contain ContextSourceSelector (知识库源文件)',
    );
  });

  it('52-TB-UI-005: center column contains TaskTypeSelector', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, makeProps()),
    );

    assert.ok(
      html.includes('任务类型'),
      'Center column must contain TaskTypeSelector',
    );
  });

  it('52-TB-UI-006: center column contains RunGuardPanel', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, makeProps()),
    );

    assert.ok(
      html.includes('ai-research-run-guard-panel'),
      'Center column must contain RunGuardPanel',
    );
  });

  it('52-TB-UI-007: right column contains ArtifactDraftPreview', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, makeProps()),
    );

    assert.ok(
      html.includes('ai-research-artifact-draft-preview'),
      'Right column must contain ArtifactDraftPreview',
    );
  });

  it('52-TB-UI-008: stage labels are displayed', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, makeProps()),
    );

    // Stage and task state labels should be present
    assert.ok(
      html.includes('阶段') || html.includes('待开始'),
      'Must display stage label',
    );
  });
});
