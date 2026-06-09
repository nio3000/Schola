import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'vitest';

import { PrivacyPage } from '../../src/features/settings/components/PrivacyPage';
import type {
  ConfirmationLogEntry,
  PrivacyConsentState,
} from '../../src/lib/contracts/settings.types';

const mockConsent: PrivacyConsentState = {
  privacyConsentAccepted: true,
  privacyConsentVersion: '1.0',
  privacyConsentAcceptedAt: '2026-01-01T00:00:00.000Z',
  allowRemoteProvider: true,
  defaultContextSendPolicy: 'always-ask' as const,
};

const mockLog: ConfirmationLogEntry[] = [];

function renderPrivacyPage(): string {
  return renderToStaticMarkup(
    React.createElement(PrivacyPage, {
      privacyConsent: mockConsent,
      confirmationLog: mockLog,
    }),
  );
}

describe('PrivacyPage UI', () => {
  it('renders the settings privacy page container', () => {
    const html = renderPrivacyPage();

    assert.match(html, /data-testid="settings-privacy-page"/);
  });

  it('shows BYOK messaging when consent is set', () => {
    const html = renderPrivacyPage();

    assert.match(html, /BYOK|自带密钥/);
  });

  it('shows local-first messaging', () => {
    const html = renderPrivacyPage();

    assert.match(html, /本地优先/);
  });

  it('shows no-upload-by-default messaging', () => {
    const html = renderPrivacyPage();

    assert.match(html, /默认不会上传|不会自动上传/);
  });

  it('renders the consent status section', () => {
    const html = renderPrivacyPage();

    assert.match(html, /data-testid="settings-section-consent"/);
  });

  it('renders the policy section', () => {
    const html = renderPrivacyPage();

    assert.match(html, /data-testid="settings-section-policy"/);
  });

  it('renders the log section', () => {
    const html = renderPrivacyPage();

    assert.match(html, /data-testid="settings-section-confirm-log"/);
  });
});
