/**
 * R6-R3 — SettingsModal real content reconnect.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { SettingsModal } from '../../../src/features/settings/components/SettingsModal';

const ROOT = resolve(__dirname, '..', '..', '..');

function readProjectFile(...parts: string[]): string {
  return readFileSync(resolve(ROOT, ...parts), 'utf8');
}

describe('settings-modal-content-r6-r3', () => {
  it('SettingsModal renders centered overlay content instead of an empty shell', () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsModal, {
        isOpen: true,
        onClose: () => {},
        children: React.createElement('div', { className: 'settings-center', 'data-testid': 'settings-center' }, 'General Provider Model Privacy About'),
      }),
    );
    expect(html).toContain('settings-modal-overlay');
    expect(html).toContain('settings-modal-content');
    expect(html).toContain('settings-center');
    expect(html).toContain('General Provider Model Privacy About');
  });

  it('WorkspaceShell passes the real SettingsCenter into SettingsModal', () => {
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    expect(shell).toContain('<SettingsModal');
    expect(shell).toContain('<SettingsCenter />');
    expect(shell).toContain('setSettingsModalOpen(true)');
  });

  it('SettingsCenter contains real settings pages and sections', () => {
    const center = readProjectFile('src', 'features', 'settings', 'SettingsCenter.tsx');
    const contracts = readProjectFile('src', 'lib', 'contracts', 'settings.types.ts');
    const general = readProjectFile('src', 'features', 'settings', 'components', 'GeneralPage.tsx');
    const ai = readProjectFile('src', 'features', 'settings', 'components', 'AIPage.tsx');
    expect(center).toContain('SettingsNav');
    expect(center).toContain('ProviderPage');
    expect(center).toContain('PrivacyPage');
    expect(center).toContain('AboutPage');
    expect(contracts).toContain("id: 'general'");
    expect(contracts).toContain("id: 'provider'");
    expect(contracts).toContain("id: 'privacy'");
    expect(contracts).toContain("id: 'about'");
    expect(general).toContain('外观');
    expect(ai).toContain('默认模型');
  });

  it('Settings stays out of BottomPanel and ordinary editor pages', () => {
    const bottom = readProjectFile('src', 'features', 'workspace', 'BottomPanel.tsx');
    const shell = readProjectFile('src', 'features', 'workspace', 'WorkspaceShell.tsx');
    expect(bottom).not.toContain('SettingsCenter');
    expect(bottom).not.toContain('SettingsModal');
    expect(shell).not.toContain("activeActivity === 'settings' ? (");
  });

  it('SettingsModal supports Esc close and scrollable modal body', () => {
    const modal = readProjectFile('src', 'features', 'settings', 'components', 'SettingsModal.tsx');
    const css = readProjectFile('src', 'styles.css');
    expect(modal).toContain("e.key === 'Escape'");
    expect(modal).toContain("document.addEventListener('keydown'");
    expect(css).toMatch(/\.settings-modal\s*\{[\s\S]*height: min\(640px, 85vh\)/);
    expect(css).toMatch(/\.settings-modal-content\s*\{[\s\S]*overflow: auto/);
    expect(css).toMatch(/\.settings-content-area\s*\{[\s\S]*overflow-y: auto/);
  });
});
