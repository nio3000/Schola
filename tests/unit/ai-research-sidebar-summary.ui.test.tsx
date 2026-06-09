/**
 * AI Research — Sidebar Summary UI Test — Phase 5-2 P1.
 *
 * Verifies:
 * - SideBar summary is lightweight (not full workbench)
 * - Summary does NOT contain full workbench components
 * - CTA button is present
 * - data-testid attributes are correct
 * - Only shows summary, not full provider cards or task UI
 *
 * Test boundaries: 52-TB-UI-010 through 52-TB-UI-015
 */
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import React, { type ReactElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { describe, it } from 'vitest';
import { AIResearchSidebarSummary } from '../../src/features/ai-research/AIResearchSidebarSummary';
import type { FileEntry } from '../../src/lib/contracts/vault.types';

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

function makeProps(overrides?: { fileTree?: readonly FileEntry[]; selectedFile?: string | null; onOpenWorkbench?: () => void }) {
  return {
    fileTree: overrides?.fileTree ?? [],
    selectedFile: overrides?.selectedFile ?? null,
    onOpenWorkbench: overrides?.onOpenWorkbench ?? (() => {}),
  } as const;
}

// ═══════════════════════════════════════════════════════════════
// Sidebar summary structure
// ═══════════════════════════════════════════════════════════════

describe('AI Research — Sidebar Summary', () => {
  it('52-TB-UI-010: renders without crashing', async () => {
    const html = await renderAsync(
      <AIResearchSidebarSummary {...makeProps()} />,
    );
    assert.ok(html.length > 0, 'Must render HTML');
    assert.ok(
      html.includes('ai-research-sidebar-summary'),
      'Must contain sidebar summary testid',
    );
  });

  it('52-TB-UI-011: displays title and kicker text', async () => {
    const html = await renderAsync(
      <AIResearchSidebarSummary {...makeProps()} />,
    );

    assert.ok(html.includes('AI 研究'), 'Must display AI research kicker');
    assert.ok(html.includes('研究工作台'), 'Must display workbench title');
  });

  it('52-TB-UI-012: contains CTA button to open workbench', async () => {
    const html = await renderAsync(
      <AIResearchSidebarSummary {...makeProps()} />,
    );

    assert.ok(
      html.includes('打开 AI Research Workbench') || html.includes('打开完整工作台') || html.includes('打开工作台'),
      'Must have CTA button to open workbench',
    );
  });

  it('52-TB-UI-013: is lightweight — does NOT contain full workbench components', async () => {
    const html = await renderAsync(
      <AIResearchSidebarSummary {...makeProps()} />,
    );

    // Must NOT contain full workbench UI elements
    assert.ok(
      !html.includes('ai-research-run-guard-panel'),
      'Sidebar must not contain RunGuardPanel',
    );
    assert.ok(
      !html.includes('ai-research-artifact-draft-preview'),
      'Sidebar must not contain ArtifactDraftPreview',
    );
    assert.ok(
      !html.includes('运行守卫'),
      'Sidebar must not contain run guard',
    );
  });

  it('52-TB-UI-014: shows provider status indicator', async () => {
    const html = await renderAsync(
      <AIResearchSidebarSummary {...makeProps()} />,
    );

    // Should show provider status (loading or ready)
    assert.ok(
      html.includes('提供者') || html.includes('provider'),
      'Sidebar must show provider status',
    );
  });

  it('52-TB-UI-015: with markdown files, shows source summary', async () => {
    const fileTree: readonly FileEntry[] = [
      {
        id: 'f-1',
        type: 'file',
        relativePath: 'notes/test.md',
        name: 'test.md',
        size: 1000,
      },
    ];

    const html = await renderAsync(
      <AIResearchSidebarSummary {...makeProps({ fileTree })} />,
    );

    // Should show some token estimate or source count
    assert.ok(
      html.includes('Token') || html.includes('token'),
      'Sidebar must show token estimate with sources',
    );
  });
});
