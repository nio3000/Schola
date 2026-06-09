/**
 * no-phase-labels-in-settings-r6-public
 * Verifies Settings source files contain no internal phase labels in user-visible text.
 * Source-code analysis — no React deps.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function src(rel: string): string {
  return readFileSync(resolve(__dirname, '..', '..', '..', rel), 'utf-8');
}

describe('no-phase-labels-in-settings', () => {
  const ai = src('src/features/settings/components/AIPage.tsx');

  it('AIPage has no Phase 5-2', () => {
    expect(ai).not.toMatch(/Phase\s*5-2/);
  });
  it('AIPage uses 后续完成', () => {
    expect(ai).toContain('AI 调用将在后续完成');
    expect(ai).toContain('真实 AI 调用将在后续完成');
    expect(ai).toContain('这些设置将在后续完成');
  });
  it('AIPage badge is 后续完成', () => {
    expect(ai).toContain('后续完成</span>');
  });
  it('AIPage keeps disabled status', () => {
    expect(ai).toMatch(/已禁用/);
  });
  it('AIPage no real AI invocation', () => {
    expect(ai).not.toMatch(/invokeAI|callAI|executeAI/);
  });

  const pp = src('src/features/settings/components/PlaceholderPage.tsx');
  it('PlaceholderPage no 即将推出', () => {
    expect(pp).not.toMatch(/即将推出/);
  });
  it('PlaceholderPage uses 后续完成', () => {
    expect(pp).toContain('后续完成');
  });
  it('PlaceholderPage has 该能力将在后续完成', () => {
    expect(pp).toContain('该能力将在后续完成');
  });
  it('PlaceholderPage no 产品化 or Productization', () => {
    expect(pp).not.toContain('产品化');
    expect(pp).not.toContain('Productization');
  });

  const sc = src('src/features/settings/SettingsCenter.tsx');
  it('SettingsCenter no Phase 5-4 phaseLabel', () => {
    expect(sc).not.toMatch(/phaseLabel="Phase 5-4"/);
  });
  it('SettingsCenter no Phase 5-P phaseLabel', () => {
    expect(sc).not.toMatch(/phaseLabel="Phase 5-P"/);
  });
  it('SettingsCenter uses 后续完成 x3+', () => {
    const m = sc.match(/phaseLabel="后续完成"/g);
    expect(m).not.toBeNull();
    expect(m!.length).toBeGreaterThanOrEqual(3);
  });
});
