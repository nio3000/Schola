import { describe, expect, it } from 'vitest';
import {
  abortAllPendingTasks,
  cancelTask,
  createTaskDraft,
  getTaskAbortSignal,
  getTaskStatus,
  markTaskStreaming,
  startTaskExecution,
} from '../../electron/services/ai-research-task.service';

function createReadyTask() {
  return createTaskDraft({
    taskType: 'analysis_summary',
    contextPackId: `pack-${Date.now()}-${Math.random()}`,
    instruction: '分析文献',
    providerId: 'openai',
    model: 'gpt-5.5',
  });
}

describe('AI Research cancellation', () => {
  it('AI-C-STREAM-011/012 cancelTask aborts the bound AbortController and marks cancelled', () => {
    const task = createReadyTask();
    startTaskExecution({ taskId: task.taskId });
    const signal = getTaskAbortSignal(task.taskId);

    const status = cancelTask({ taskId: task.taskId });

    expect(signal?.aborted).toBe(true);
    expect(status.state).toBe('cancelled');
    expect(getTaskStatus(task.taskId).state).toBe('cancelled');
  });

  it('AI-C-P1-035 transitions running to streaming on first chunk', () => {
    const task = createReadyTask();
    startTaskExecution({ taskId: task.taskId });

    const status = markTaskStreaming(task.taskId);

    expect(status?.state).toBe('streaming');
  });

  it('AI-C-P0-018 abortAllPendingTasks cancels all pending requests before quit', () => {
    const first = createReadyTask();
    const second = createReadyTask();
    startTaskExecution({ taskId: first.taskId });
    startTaskExecution({ taskId: second.taskId });
    const firstSignal = getTaskAbortSignal(first.taskId);
    const secondSignal = getTaskAbortSignal(second.taskId);

    abortAllPendingTasks();

    expect(firstSignal?.aborted).toBe(true);
    expect(secondSignal?.aborted).toBe(true);
    expect(getTaskStatus(first.taskId).state).toBe('cancelled');
    expect(getTaskStatus(second.taskId).state).toBe('cancelled');
  });
});
