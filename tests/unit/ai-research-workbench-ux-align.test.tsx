import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import React, { type ReactElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { describe, it } from 'vitest';
import { AIResearchMainView } from '../../src/features/ai-research/AIResearchMainView';

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

describe('AI Research Workbench UX align', () => {
  it('renders columns in context-response-artifact order', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, {
        vaultId: null,
        fileTree: [],
        selectedFile: null,
      }),
    );

    const contextIndex = html.indexOf('ai-research-context-column');
    const responseIndex = html.indexOf('ai-research-response-column');
    const artifactIndex = html.indexOf('ai-research-artifact-column');

    assert.ok(contextIndex >= 0, 'Context column must exist');
    assert.ok(responseIndex > contextIndex, 'Response column must be after context column');
    assert.ok(artifactIndex > responseIndex, 'Artifact column must be after response column');
  });

  it('places response before runtime controls before task input', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, {
        vaultId: null,
        fileTree: [],
        selectedFile: null,
      }),
    );

    const responseIndex = html.indexOf('模型回复');
    const runtimeIndex = html.indexOf('ai-research-runtime-controls');
    const taskIndex = html.indexOf('ai-research-task-input');

    assert.ok(responseIndex >= 0, 'Response title must exist');
    assert.ok(runtimeIndex > responseIndex, 'Runtime controls must be below response');
    assert.ok(taskIndex > runtimeIndex, 'Task input must be below runtime controls');
  });

  it('does not leak model supplier settings into workbench', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, {
        vaultId: null,
        fileTree: [],
        selectedFile: null,
      }),
    );

    for (const forbidden of ['API 请求地址', 'API Key', '获取模型列表', '管理与测速']) {
      assert.equal(html.includes(forbidden), false, `Forbidden supplier config: ${forbidden}`);
    }
  });

  it('keeps task status inside the main left column', async () => {
    const html = await renderAsync(
      React.createElement(AIResearchMainView, {
        vaultId: null,
        fileTree: [],
        selectedFile: null,
      }),
    );

    const contextIndex = html.indexOf('ai-research-context-column');
    const taskStatusIndex = html.indexOf('ai-research-task-status');
    const responseIndex = html.indexOf('ai-research-response-column');

    assert.ok(taskStatusIndex > contextIndex, 'Task status must be inside/after context column');
    assert.ok(taskStatusIndex < responseIndex, 'Task status must be before center response column');
    assert.ok(html.includes('空闲'), 'Idle task status must be visible');
    assert.ok(html.includes('自动保存'), 'Auto-save boundary must be visible');
    assert.ok(html.includes('否'), 'Auto-save boundary must be false');
  });
});
