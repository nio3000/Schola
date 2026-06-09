/**
 * UX Rebase — Provider Connect Modal Test (P0: UX-TB-P0-028)
 * Phase 5-UX-REBASE-IMP-CONTINUE.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { ProviderConnectModal } from '../../../src/features/settings/components/ProviderConnectModal';
import { PROVIDER_PRESETS } from '../../../src/lib/contracts/provider-preset.types';

describe('ux-rebase provider-connect-modal (P0)', () => {
  const openaiPreset = PROVIDER_PRESETS[0];

  it('UX-TB-P0-028: renders when isOpen and provider given', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderConnectModal, {
        isOpen: true,
        provider: openaiPreset,
        onClose: () => {},
        onConnect: () => {},
      }),
    );
    expect(html).toContain('provider-connect-modal');
    expect(html).toContain('连接 OpenAI');
  });

  it('returns null when isOpen is false', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderConnectModal, {
        isOpen: false,
        provider: openaiPreset,
        onClose: () => {},
        onConnect: () => {},
      }),
    );
    expect(html).toBe('');
  });

  it('returns null when provider is null', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderConnectModal, {
        isOpen: true,
        provider: null,
        onClose: () => {},
        onConnect: () => {},
      }),
    );
    expect(html).toBe('');
  });

  it('has API key input field', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderConnectModal, {
        isOpen: true,
        provider: openaiPreset,
        onClose: () => {},
        onConnect: () => {},
      }),
    );
    expect(html).toContain('provider-connect-key-input');
  });

  it('has submit and cancel buttons', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderConnectModal, {
        isOpen: true,
        provider: openaiPreset,
        onClose: () => {},
        onConnect: () => {},
      }),
    );
    expect(html).toContain('provider-connect-submit');
    expect(html).toContain('provider-connect-cancel');
  });

  it('submit is disabled when input is empty', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderConnectModal, {
        isOpen: true,
        provider: openaiPreset,
        onClose: () => {},
        onConnect: () => {},
      }),
    );
    expect(html).toContain('disabled');
  });

  it('has back button', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderConnectModal, {
        isOpen: true,
        provider: openaiPreset,
        onClose: () => {},
        onConnect: () => {},
      }),
    );
    expect(html).toContain('provider-connect-back');
  });
});
