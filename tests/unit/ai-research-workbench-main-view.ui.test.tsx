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
import fs from 'node:fs';
import path from 'node:path';
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

function readSource(relativePath: string): string {
  return fs.readFileSync(path.resolve(relativePath), 'utf-8');
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

  it('52-TB-UI-003: center column contains chat thread with assistant-ready message', async () => {
    const html = await renderAsync(React.createElement(AIResearchMainView, makeProps()));

    // Phase 5-5-C-POST-SYNC-AI-RESEARCH-CHAT-THREAD-FIX:
    // Center column now uses conversation thread instead of static response panel.
    assert.ok(html.includes('ai-research-chat-thread'), 'Center column must contain chat thread');
    assert.ok(html.includes('AI 研究工作台'), 'Chat thread must show workbench welcome');
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
    assert.ok(
      html.includes('ai-research-runtime-model-select'),
      'Must render runtime model select',
    );
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
    assert.equal(
      html.includes('获取模型列表'),
      false,
      'Workbench must not show model fetch action',
    );
    assert.equal(html.includes('管理与测速'), false, 'Workbench must not show latency action');
  });

  it('AI-C-P2-010: renders a task-scoped cancel button', async () => {
    const html = await renderAsync(React.createElement(AIResearchMainView, makeProps()));

    assert.ok(html.includes('ai-research-cancel-btn'), 'Must render cancel button');
    assert.ok(html.includes('取消'), 'Cancel button label must be visible');
  });

  it('AI-C-STREAM-013: response area prefers partial streaming response before cancelled empty state', () => {
    const source = readSource('src/features/ai-research/AIResearchMainView.tsx');

    assert.ok(
      source.includes('workbench.streamingResponse.length > 0'),
      'Response area must check partial streaming text',
    );
    assert.ok(
      source.indexOf('workbench.streamingResponse.length > 0') <
        source.indexOf("workbench.stage === 'cancelled'"),
      'Partial streaming text must be rendered before cancelled fallback',
    );
  });

  it('AI-C-STREAM-014: cancelled tasks allow new send via single send button', () => {
    const source = readSource('src/features/ai-research/AIResearchMainView.tsx');

    // Phase 5-5-C-POST-SYNC-AI-RESEARCH-SEND-FLOW-FIX:
    // The two-step draft+run flow is replaced by a single send/stop button.
    // Cancelled tasks allow immediate next send via the same send button.
    assert.ok(
      source.includes('ai-research-send-btn'),
      'Main view must have a send button for new rounds after cancel',
    );
    assert.ok(
      source.includes('ai-research-stop-btn'),
      'Main view must have a stop button during running/streaming',
    );
  });

  it('AI-C-PRIVACY-001: renders privacy consent modal entry without default consent', async () => {
    const html = await renderAsync(React.createElement(AIResearchMainView, makeProps()));
    const viewSource = readSource('src/features/ai-research/AIResearchMainView.tsx');
    const hookSource = readSource('src/features/ai-research/hooks/useAIResearchWorkbench.ts');

    assert.ok(
      viewSource.includes('PrivacyConsentModal'),
      'Main view must wire the privacy consent modal',
    );
    assert.ok(
      viewSource.includes('ai-research-privacy-gate-note'),
      'Main view must expose a visible privacy gate note',
    );
    assert.ok(hookSource.includes('useState(false)'), 'Privacy consent must not default to true');
    assert.equal(
      html.includes('API Key'),
      false,
      'Workbench must not show raw API key labels in the privacy flow',
    );
  });

  it('AI-C-PRIVACY-002: send flow checks privacy consent before execution', () => {
    const hookSource = readSource('src/features/ai-research/hooks/useAIResearchWorkbench.ts');
    const viewSource = readSource('src/features/ai-research/AIResearchMainView.tsx');

    // Phase 5-5-C-POST-SYNC-AI-RESEARCH-SEND-FLOW-FIX:
    // Privacy consent check is now in sendMessage hook, not in UI button handler.
    assert.ok(
      hookSource.includes('!privacyConsented'),
      'sendMessage must defer to privacy consent when not consented',
    );
    assert.ok(
      viewSource.includes('continuePendingSend'),
      'Main view must auto-continue pending send after privacy consent',
    );
    assert.ok(
      viewSource.includes('PrivacyConsentModal'),
      'Main view must still wire the privacy consent modal',
    );
  });

  it('AI-C-PRIVACY-005: context confirmation is persisted before local confirmed state', () => {
    const source = readSource('src/features/ai-research/AIResearchMainView.tsx');
    const persistIndex = source.indexOf('await confirmContextPack');
    const localIndex = source.indexOf('workbench.setContextConfirmed(true)');

    assert.ok(persistIndex > 0, 'Context confirmation must call the fixed confirm IPC wrapper');
    assert.ok(
      localIndex > persistIndex,
      'Local contextConfirmed state must be set after main-process confirmation',
    );
  });

  it('AI-C-PRIVACY-003: confirming privacy consent does not auto-send provider request', () => {
    const source = readSource('src/features/ai-research/AIResearchMainView.tsx');
    const confirmIndex = source.indexOf('workbench.setPrivacyConsented(true)');
    const closeIndex = source.indexOf('setShowPrivacyConsent(false)', confirmIndex);
    const runIndex = source.indexOf('void workbench.runTask();', confirmIndex);

    assert.ok(
      source.includes('setPrivacyConsent(createAcceptedPrivacyConsentState(true))'),
      'Confirm action must persist privacy consent for main-process preflight',
    );
    assert.ok(
      source.includes('setAIPreferences({'),
      'Confirm action must enable AI preferences for provider readiness',
    );
    assert.ok(confirmIndex > 0, 'Confirm action must set privacy consent');
    assert.ok(closeIndex > confirmIndex, 'Confirm action must close the modal');
    assert.equal(runIndex, -1, 'Confirming privacy consent must not automatically call runTask');
  });

  it('AI-C-PRIVACY-004: privacy modal copy states scope and no automatic persistence', () => {
    const source = readSource('src/features/ai-research/components/PrivacyConsentModal.tsx');

    assert.ok(source.includes('已确认 ContextPack'), 'Modal must mention confirmed ContextPack');
    assert.ok(
      source.includes('不发送整个 Vault'),
      'Modal must say it does not send the whole Vault',
    );
    assert.ok(
      source.includes('不发送未选择文件'),
      'Modal must say it does not send unselected files',
    );
    assert.ok(source.includes('不会发送 API key'), 'Modal must say it does not send API keys');
    assert.ok(source.includes('metadata-only'), 'Modal must mention metadata-only files');
    assert.ok(source.includes('不会自动写入 Vault'), 'Modal must state no automatic Vault write');
    assert.ok(
      source.includes('Artifact 不会自动保存'),
      'Modal must state Artifact is not auto-saved',
    );
  });
});
