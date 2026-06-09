/**
 * UX Rebase — Settings Modal Test (P0: UX-TB-P0-023 ~ 025)
 * Phase 5-UX-REBASE-IMP.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { SettingsModal } from '../../../src/features/settings/components/SettingsModal';

describe('ux-rebase settings-modal (P0)', () => {
  it('UX-TB-P0-023: modal renders when isOpen is true', () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsModal, { isOpen: true, onClose: () => {}, children: null }),
    );
    expect(html).toContain('settings-modal');
  });

  it('UX-TB-P0-024: modal is NOT embedded in SideBar (it is a top-level overlay)', () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsModal, { isOpen: true, onClose: () => {}, children: null }),
    );
    expect(html).toContain('settings-modal-overlay');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it('UX-TB-P0-025: modal returns null when closed', () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsModal, { isOpen: false, onClose: () => {}, children: null }),
    );
    expect(html).toBe('');
  });

  it('modal has close button', () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsModal, { isOpen: true, onClose: () => {}, children: null }),
    );
    expect(html).toContain('settings-modal-close');
  });

  it('modal has a real content host for SettingsCenter', () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsModal, {
        isOpen: true,
        onClose: () => {},
        children: React.createElement('div', { 'data-testid': 'settings-center' }, 'SettingsCenter'),
      }),
    );
    expect(html).toContain('settings-modal-content');
    expect(html).toContain('settings-center');
    expect(html).toContain('SettingsCenter');
  });

  it('modal no longer owns duplicate navigation; SettingsCenter owns settings nav', () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsModal, { isOpen: true, onClose: () => {}, children: null }),
    );
    expect(html).not.toContain('settings-modal-nav');
    expect(html).not.toContain('settings-nav-appearance');
  });

  it('placeholder and disabled sections are owned by SettingsCenter pages, not the modal shell', () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsModal, { isOpen: true, onClose: () => {}, children: null }),
    );
    expect(html).not.toContain('settings-nav-vault');
    expect(html).not.toContain('settings-nav-export');
    expect(html).not.toContain('settings-nav-plugin');
  });
});
