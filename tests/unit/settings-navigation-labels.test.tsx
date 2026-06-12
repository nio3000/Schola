import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import { SETTINGS_PAGES } from '../../src/lib/contracts/settings.types';

describe('settings navigation labels', () => {
  it('uses AI preference and model supplier labels', () => {
    const aiPage = SETTINGS_PAGES.find((page) => page.id === 'ai');
    const providerPage = SETTINGS_PAGES.find((page) => page.id === 'provider');

    assert.equal(aiPage?.label, 'AI 偏好');
    assert.equal(providerPage?.label, '模型供应商');
    assert.equal(providerPage?.sections[0]?.label, '模型供应商列表');
  });

  it('does not expose old ambiguous labels for AI/provider pages', () => {
    const labels = SETTINGS_PAGES.map((page) => page.label);

    assert.equal(labels.includes('AI'), false);
    assert.equal(labels.includes('提供者'), false);
  });
});
