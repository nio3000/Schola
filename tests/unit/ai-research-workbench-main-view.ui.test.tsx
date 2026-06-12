/**
 * AI Research — Workbench Main View UI Test — Phase 5-2 P1.
 *
 * Verifies current R3 semantic three-column structure:
 * - Left: context / references
 * - Center: model response, runtime model/status/skill controls, task input
 * - Right: artifact draft
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
    const html = await renderAsync(React.createElement(AIResearchMainView, makeProps()));
    assert.ok(html.length > 0, 'Must render HTML');
    assert.ok(html.includes('ai-research-main-view'), 'Must contain main view testid');
  });

  it('52-TB-UI-002: renders R3 three-column semantic layout', async () => {
    const html = await renderAsync(React.createElement(AIResearchMainView, makeProps()));

    assert.ok(html.includes('AI 研究工作台'), 'Must render AI Research header');
    assert.ok(html.includes('ai-research-context-column'), 'Must render context column');
    assert.ok(html.includes('ai-research-response-column'), 'Must render response column');
    assert.ok(html.includes('ai-research-artifact-column'), 'Must render artifact column');
  });

  it('52-TB-UI-003: center column contains model response first', async () => {
    const html = await renderAsync(React.createElement(AIResearchMainView, makeProps()));

    assert.ok(html.includes('模型回复'), 'Center column must contain model response area');
    assert.ok(html.includes('尚未生成回复'), 'Response area must show empty state');
  });

  it('52-TB-UI-004: left column contains context and references only', async () => {
    const html = await renderAsync(React.createElement(AIResearchMainView, makeProps()));

    assert.ok(html.includes('上下文'), 'Left column must contain context title');
    assert.ok(html.includes('上下文摘要'), 'Left column must contain context summary');
    assert.ok(html.includes('任务状态'), 'Left column must contain task status');
    assert.ok(html.includes('引用与推断'), 'Left column must contain reference list');
    assert.ok(html.includes('尚未选择上下文资源'), 'Context column must show empty state');
  });

  it('52-TB-UI-005: center column contains runtime model and skill controls', async () => {
    const html = await renderAsync(React.createElement(AIResearchMainView, makeProps()));

    assert.ok(html.includes('ai-research-runtime-controls'), 'Must render runtime controls');
    assert.ok(html.includes('ai-research-runtime-model-select'), 'Must render runtime model select');
    assert.ok(html.includes('ai-research-skill-select'), 'Must render skill select');
  });

  it('52-TB-UI-006: center column contains task input below runtime controls', async () => {
    const html = await renderAsync(React.createElement(AIResearchMainView, makeProps()));

    assert.ok(html.includes('ai-research-task-input'), 'Must render task input area');
    assert.ok(html.includes('ai-research-instruction-editor'), 'Must contain InstructionEditor');
  });

  it('52-TB-UI-007: right column contains artifact draft only', async () => {
    const html = await renderAsync(React.createElement(AIResearchMainView, makeProps()));

    assert.ok(
      html.includes('ai-research-artifact-draft-preview'),
      'Right column must contain artifact draft preview',
    );
    assert.ok(html.includes('尚未生成草稿'), 'Artifact column must show draft empty state');
  });

  it('52-TB-UI-008: workbench does not expose provider configuration details', async () => {
    const html = await renderAsync(React.createElement(AIResearchMainView, makeProps()));

    assert.equal(html.includes('API 请求地址'), false, 'Workbench must not show API URL field');
    assert.equal(html.includes('API Key'), false, 'Workbench must not show API Key field');
    assert.equal(html.includes('获取模型列表'), false, 'Workbench must not show model fetch action');
    assert.equal(html.includes('管理与测速'), false, 'Workbench must not show latency action');
  });
});
