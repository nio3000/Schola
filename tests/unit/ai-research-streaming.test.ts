import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf-8');
}

describe('AI Research streaming renderer guards', () => {
  it('AI-C-STREAM-009 model switch cancels the active task', () => {
    const hook = readSource('src/features/ai-research/hooks/useAIResearchWorkbench.ts');

    expect(hook).toContain('cancelTaskIfActive(currentTask)');
    expect(hook).toContain('const changeModel = useCallback');
    expect(hook).toContain('const changeProvider = useCallback');
  });

  it('AI-C-STREAM-010 double send is blocked by in-flight guard', () => {
    const hook = readSource('src/features/ai-research/hooks/useAIResearchWorkbench.ts');

    expect(hook).toContain('runInFlightRef.current');
    expect(hook).toContain("currentTask.state === 'running'");
    expect(hook).toContain("currentTask.state === 'streaming'");
  });

  it('AI-C-STREAM-008 unmount cleans up task subscription', () => {
    const hook = readSource('src/features/ai-research/hooks/useAIResearchWorkbench.ts');

    expect(hook).toContain('unsubscribeTaskRef.current?.()');
    expect(hook).toMatch(/useEffect\(\s*\(\)\s*=>\s*\(\)\s*=>/);
  });

  it('AI-C-STREAM-016 streaming path does not save Artifact or write Vault files', () => {
    const ipc = readSource('electron/ipc/ai-research.ipc.ts');

    expect(ipc).toContain('executeStreamingInvocation');
    expect(ipc).not.toMatch(/saveNote\(|writeFileSync\(|writeFile\(/);
  });

  it('AI-C-STREAM-013 cancel keeps the partial streaming response in renderer state', () => {
    const hook = readSource('src/features/ai-research/hooks/useAIResearchWorkbench.ts');
    const cancelBlock = hook.match(
      /const cancelCurrentTask = useCallback[\s\S]*?\n  \}, \[currentTask\]\);/,
    )?.[0];

    expect(cancelBlock).toContain("setStage('cancelled')");
    expect(cancelBlock).not.toContain("setStreamingResponse('')");
  });

  it('AI-C-STREAM-013 subsequent generation starts with a fresh response buffer', () => {
    const hook = readSource('src/features/ai-research/hooks/useAIResearchWorkbench.ts');

    expect(hook).toContain("setStage('running')");
    expect(hook).toContain("setStreamingResponse('')");
    expect(hook).toContain('setStreamingResponse((current) => `${current}${chunk.content}`)');
  });

  it('AI-C-STREAM-013 cancel unsubscribes so old task chunks are not retained', () => {
    const hook = readSource('src/features/ai-research/hooks/useAIResearchWorkbench.ts');
    const preload = readSource('electron/preload.ts');

    expect(hook).toContain('unsubscribeTaskRef.current?.()');
    expect(hook).toContain('unsubscribeTaskRef.current = null');
    expect(preload).toContain('chunk.taskId !== safeTaskId');
  });
});
