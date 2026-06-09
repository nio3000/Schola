import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';

const ACTIVITY_BAR_PATH = resolve(__dirname, '..', '..', '..', 'src', 'features', 'workspace', 'ActivityBar.tsx');

describe('activity-bar-no-action-boundary (P0)', () => {
  const content = readFileSync(ACTIVITY_BAR_PATH, 'utf8');

  it('ActivityBar should NOT trigger provider invocation', () => {
    // The word "provider" may appear in comment headers describing what NOT to do
    const hasProviderCall = content.includes('window.schola.') && content.includes('provider');
    assert.ok(!hasProviderCall, 'ActivityBar should not invoke providers via window.schola');
  });

  it('ActivityBar should NOT trigger context send', () => {
    assert.ok(!content.includes('contextSend'), 'ActivityBar should not send context');
    assert.ok(!content.includes('context.send'), 'ActivityBar should not send context');
  });

  it('ActivityBar should NOT trigger export', () => {
    const hasExportCall = content.match(/export\s*\(/) || content.includes('exportFile');
    assert.ok(!hasExportCall || content.includes('// No runtime'), 'ActivityBar should not trigger export');
  });

  it('ActivityBar should NOT write to Vault', () => {
    assert.ok(!content.includes('writeFile'), 'ActivityBar should not write files');
    assert.ok(!content.includes('saveFile'), 'ActivityBar should not save files');
  });

  it('ActivityBar should NOT trigger plugin run', () => {
    assert.ok(!content.includes('plugin.run'), 'ActivityBar should not run plugins');
    assert.ok(!content.includes('pluginLoad'), 'ActivityBar should not load plugins');
  });

  it('ActivityBar onClick should only call onActivityChange', () => {
    assert.ok(content.includes('onActivityChange'), 'ActivityBar should use onActivityChange');
    const onClickMatches = content.match(/onClick/g);
    // Should only have onClick for onActivityChange, nothing else
    assert.ok(onClickMatches && onClickMatches.length > 0, 'ActivityBar should have onClick handlers');
  });
});
