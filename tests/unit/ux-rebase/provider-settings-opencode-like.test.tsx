/**
 * UX Rebase — Provider Settings Test (P0: UX-TB-P0-026 ~ 030)
 * Phase 5-UX-REBASE-IMP-CONTINUE.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ProviderSettingsList } from '../../../src/features/settings/components/ProviderSettingsList';
import { PROVIDER_PRESETS } from '../../../src/lib/contracts/provider-preset.types';

describe('ux-rebase provider-settings-opencode-like (P0)', () => {
  const emptyKeyStatuses: readonly any[] = [];

  it('UX-TB-P0-026: renders connected and unconnected sections', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderSettingsList, {
        keyStatuses: emptyKeyStatuses,
        presets: PROVIDER_PRESETS.slice(0, 4),
        onConnect: () => {},
        onDisconnect: () => {},
      }),
    );
    expect(html).toContain('热门提供商');
    expect(html).toContain('provider-row-openai');
  });

  it('UX-TB-P0-027: each row has a single connect or disconnect action', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderSettingsList, {
        keyStatuses: emptyKeyStatuses,
        presets: [PROVIDER_PRESETS[0]],
        onConnect: () => {},
        onDisconnect: () => {},
      }),
    );
    expect(html).toContain('provider-connect-openai');
    expect(html).not.toContain('provider-disconnect-openai');
  });

  it('UX-TB-P0-029: no API key displayed in provider list', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderSettingsList, {
        keyStatuses: [{ providerId: 'openai', status: 'configured', maskedSuffix: 'sk-...abc' }],
        presets: [PROVIDER_PRESETS[0]],
        onConnect: () => {},
        onDisconnect: () => {},
      }),
    );
    // Masked key shows provider as connected but does NOT show actual key
    expect(html).toContain('provider-disconnect-openai');
    expect(html).not.toContain('sk-...abc');
  });

  it('connected provider shows disconnect button', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderSettingsList, {
        keyStatuses: [{ providerId: 'openai', status: 'configured', maskedSuffix: 'sk-...abc' }],
        presets: [PROVIDER_PRESETS[0]],
        onConnect: () => {},
        onDisconnect: () => {},
      }),
    );
    expect(html).toContain('provider-disconnect-openai');
    expect(html).not.toContain('provider-connect-openai');
  });

  it('unconnected provider shows connect button', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderSettingsList, {
        keyStatuses: emptyKeyStatuses,
        presets: [PROVIDER_PRESETS[0]],
        onConnect: () => {},
        onDisconnect: () => {},
      }),
    );
    expect(html).toContain('provider-connect-openai');
  });
});
