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

import { PrivacyConsentDialog } from '../../src/features/settings/components/PrivacyConsentDialog';

function renderDialog(): string {
  return renderToStaticMarkup(
    React.createElement(PrivacyConsentDialog, {
      onConsentSaved: () => {},
      onDismiss: () => {},
    }),
  );
}

describe('PrivacyConsentDialog UI', () => {
  it('renders the privacy consent dialog container', () => {
    const html = renderDialog();

    assert.match(html, /data-testid="privacy-consent-dialog"/);
    assert.match(html, /role="dialog"/);
  });

  it('contains local-first messaging', () => {
    const html = renderDialog();

    assert.match(html, /本地优先/);
  });

  it('contains BYOK messaging', () => {
    const html = renderDialog();

    assert.match(html, /BYOK|自带密钥/);
  });

  it('contains no-auto-upload messaging', () => {
    const html = renderDialog();

    assert.match(html, /默认不会上传|不会自动/);
  });

  it('renders remote and local radio options', () => {
    const html = renderDialog();

    assert.match(html, /data-testid="privacy-radio-allow"/);
    assert.match(html, /data-testid="privacy-radio-local"/);
    assert.match(html, /value="allow"/);
    assert.match(html, /value="local-only"/);
  });

  it('renders confirm and dismiss buttons', () => {
    const html = renderDialog();

    assert.match(html, /data-testid="privacy-consent-confirm"/);
    assert.match(html, /data-testid="privacy-consent-cancel"/);
    assert.match(html, /确认并保存/);
    assert.match(html, /稍后决定/);
  });

  it('renders with local-only selected by default when allowRemote is false', () => {
    const html = renderDialog();

    assert.match(html, /data-testid="privacy-radio-local"[^>]*checked=""/);
    assert.doesNotMatch(html, /data-testid="privacy-radio-allow"[^>]*checked=""/);
  });
});
