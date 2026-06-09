import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'vitest';

(globalThis as Record<string, unknown>).window = {
  schola: {
    settings: {
      setPrivacyConsent: async () => ({}),
      getPrivacyConsent: async () => null,
    },
  },
};

import {
  ContextConfirmDialog,
  type ContextConfirmResult,
  type ContextConfirmSummary,
} from '../../src/features/settings/components/ContextConfirmDialog';

const mockSummary: ContextConfirmSummary = {
  fileCount: 3,
  totalTokens: 12800,
  truncatedFileCount: 2,
  providerId: 'openai',
  model: 'gpt-4.1-mini',
  providerDisplayName: 'OpenAI',
};

function renderDialog(summary: ContextConfirmSummary = mockSummary): string {
  return renderToStaticMarkup(
    React.createElement(ContextConfirmDialog, {
      summary,
      onConfirm: (_result: ContextConfirmResult) => {},
      onCancel: () => {},
    }),
  );
}

describe('ContextConfirmDialog UI', () => {
  it('renders the context confirm dialog container', () => {
    const html = renderDialog();

    assert.match(html, /data-testid="context-confirm-dialog"/);
    assert.match(html, /role="dialog"/);
  });

  it('shows provider display name', () => {
    const html = renderDialog();

    assert.match(html, new RegExp(mockSummary.providerDisplayName));
  });

  it('shows model name', () => {
    const html = renderDialog();

    assert.match(html, new RegExp(mockSummary.model));
  });

  it('shows fileCount value', () => {
    const html = renderDialog();

    assert.match(html, />3</);
    assert.match(html, /文件数量/);
  });

  it('shows totalTokens value', () => {
    const html = renderDialog();

    assert.match(html, /12,800/);
    assert.match(html, /预估 Token/);
  });

  it('shows truncatedFileCount when it is greater than zero', () => {
    const html = renderDialog();

    assert.match(html, /已截断文件/);
    assert.match(html, />2</);
  });

  it('renders the per-request radio option', () => {
    const html = renderDialog();

    assert.match(html, /data-testid="context-scope-per-request"/);
    assert.match(html, /value="per-request"/);
  });

  it('renders the per-session radio option', () => {
    const html = renderDialog();

    assert.match(html, /data-testid="context-scope-per-session"/);
    assert.match(html, /value="per-session"/);
  });

  it('renders confirm and cancel buttons', () => {
    const html = renderDialog();

    assert.match(html, /data-testid="context-confirm-confirm"/);
    assert.match(html, /data-testid="context-confirm-cancel"/);
    assert.match(html, /确认发送/);
    assert.match(html, /取消/);
  });

  it('does not render raw API key patterns', () => {
    const html = renderDialog({
      ...mockSummary,
      providerId: 'sk-test-provider',
    });

    assert.doesNotMatch(html, /sk-[A-Za-z0-9_-]{8,}/);
    assert.doesNotMatch(html, /[A-Za-z0-9_-]{32,}/);
  });
});
