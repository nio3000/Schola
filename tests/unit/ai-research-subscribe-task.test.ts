import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_RESEARCH_SUBSCRIBE_TASK_CHANNEL,
  AI_RESEARCH_TASK_CHUNK_EVENT,
  AI_RESEARCH_TASK_DONE_EVENT,
  AI_RESEARCH_TASK_ERROR_EVENT,
  type ChatChunk,
} from '../../src/lib/contracts/ai-research.types';

const repoRoot = path.resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf-8');
}

describe('AI Research subscribeTask bridge', () => {
  it('AI-C-IPC-010 defines fixed subscribe and task event channels', () => {
    expect(AI_RESEARCH_SUBSCRIBE_TASK_CHANNEL).toBe('ai-research:subscribe-task');
    expect(AI_RESEARCH_TASK_CHUNK_EVENT).toBe('ai-research:task-chunk');
    expect(AI_RESEARCH_TASK_DONE_EVENT).toBe('ai-research:task-done');
    expect(AI_RESEARCH_TASK_ERROR_EVENT).toBe('ai-research:task-error');
  });

  it('AI-C-STREAM-004 ChatChunk is task-bound and discriminated', () => {
    const content: ChatChunk = {
      type: 'content',
      taskId: 'task-1',
      content: 'hello',
      index: 0,
    };
    const done: ChatChunk = { type: 'done', taskId: 'task-1', durationMs: 12 };
    const error: ChatChunk = {
      type: 'error',
      taskId: 'task-1',
      error: { code: 'network_error', message: '网络请求失败。' },
    };

    expect(content.taskId).toBe('task-1');
    expect(done.type).toBe('done');
    expect(error.error).not.toHaveProperty('apiKey');
  });

  it('AI-C-STREAM-002/003 preload subscribeTask returns unsubscribe without generic channel input', () => {
    const preload = readSource('electron/preload.ts');

    expect(preload).toContain('subscribeTask: (taskId: string');
    expect(preload).toContain('return () =>');
    expect(preload).toContain('removeListener(AI_RESEARCH_TASK_CHUNK_EVENT');
    expect(preload).toContain('removeListener(AI_RESEARCH_TASK_DONE_EVENT');
    expect(preload).toContain('removeListener(AI_RESEARCH_TASK_ERROR_EVENT');
    expect(preload).not.toContain('subscribeTask: (channel');
    expect(preload).not.toContain('ipcRenderer:');
  });

  it('AI-C-STREAM-001 preload filters events by taskId', () => {
    const preload = readSource('electron/preload.ts');

    expect(preload).toContain('chunk.taskId !== safeTaskId');
  });
});
