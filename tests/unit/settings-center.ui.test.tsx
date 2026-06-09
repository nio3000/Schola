import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'vitest';

(globalThis as Record<string, unknown>).window = {
  schola: {
    settings: {
      getProviderPresets: async () => [],
      getProviderConfigs: async () => [],
      getApiKeyStatus: async () => [],
      getPrivacyConsent: async () => null,
      getAIPreferences: async () => ({
        aiEnabled: false,
        defaultProviderId: null,
        defaultModel: null,
        updatedAt: '',
      }),
      getConfirmationLog: async () => [],
      setProviderConfig: async () => ({}),
      getProviderModels: async () => [],
      setApiKey: async () => ({}),
      clearApiKey: async () => ({}),
      setPrivacyConsent: async () => ({}),
      getContextSendPolicy: async () => 'always-ask',
      setContextSendPolicy: async () => 'always-ask',
      setAIPreferences: async () => ({}),
    },
  },
};

import { SettingsCenter } from '../../src/features/settings/SettingsCenter';
import { AIPage } from '../../src/features/settings/components/AIPage';
import { AboutPage } from '../../src/features/settings/components/AboutPage';
import { GeneralPage } from '../../src/features/settings/components/GeneralPage';
import { PlaceholderPage } from '../../src/features/settings/components/PlaceholderPage';
import { PrivacyPage } from '../../src/features/settings/components/PrivacyPage';
import { ProviderPage } from '../../src/features/settings/components/ProviderPage';
import { SettingsNav } from '../../src/features/settings/components/SettingsNav';
import { SETTINGS_PAGES } from '../../src/lib/contracts/settings.types';

const neutralAIPreferences = {
  aiEnabled: false,
  defaultProviderId: null,
  defaultModel: null,
  updatedAt: '',
};

describe('Settings Center UI', () => {
  it('SettingsNav renders 7 navigation items from SETTINGS_PAGES.length', () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsNav, {
        activePage: 'general',
        onPageChange: () => {},
      }),
    );

    const navItems = html.match(/data-testid="settings-nav-[^"]+"/g) ?? [];
    assert.equal(navItems.length, SETTINGS_PAGES.length);
  });

  it('SettingsNav renders labels for every settings page', () => {
    const html = renderToStaticMarkup(
      React.createElement(SettingsNav, {
        activePage: 'general',
        onPageChange: () => {},
      }),
    );

    for (const page of SETTINGS_PAGES) {
      assert.match(html, new RegExp(page.label));
    }
  });

  it('SettingsCenter renders with data-testid="settings-center"', () => {
    const html = renderToStaticMarkup(React.createElement(SettingsCenter));

    assert.match(html, /data-testid="settings-center"/);
  });

  it('GeneralPage renders with 通用设置 text', () => {
    const html = renderToStaticMarkup(React.createElement(GeneralPage));

    assert.match(html, /通用设置/);
  });

  it('GeneralPage renders 即将推出 section badges', () => {
    const html = renderToStaticMarkup(React.createElement(GeneralPage));

    assert.match(html, /即将推出/);
  });

  it('AIPage renders Phase 5-2 text and notice test id', () => {
    const html = renderToStaticMarkup(
      React.createElement(AIPage, { aiPrefs: neutralAIPreferences }),
    );

    assert.match(html, /Phase 5-2/);
    assert.match(html, /data-testid="settings-ai-notice"/);
  });

  it('AIPage shows AI 调用将在后续 Phase 5-2 接入 text', () => {
    const html = renderToStaticMarkup(
      React.createElement(AIPage, { aiPrefs: neutralAIPreferences }),
    );

    assert.match(html, /AI 调用将在后续 Phase 5-2 接入/);
  });

  it('ProviderPage renders with data-testid', () => {
    const html = renderToStaticMarkup(
      React.createElement(ProviderPage, {
        presets: [],
        configs: [],
        keyStatuses: [],
        onRefresh: () => {},
      }),
    );

    assert.match(html, /data-testid="settings-provider-page"/);
  });

  it('PrivacyPage renders with data-testid', () => {
    const html = renderToStaticMarkup(
      React.createElement(PrivacyPage, {
        privacyConsent: null,
        confirmationLog: [],
      }),
    );

    assert.match(html, /data-testid="settings-privacy-page"/);
  });

  it('PlaceholderPage renders with title text', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceholderPage, {
        title: '占位设置',
        phaseLabel: 'Phase 5-X',
      }),
    );

    assert.match(html, /占位设置/);
  });

  it('PlaceholderPage with title="导出设置" renders', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceholderPage, {
        title: '导出设置',
        phaseLabel: 'Phase 5-4',
      }),
    );

    assert.match(html, /导出设置/);
  });

  it('PlaceholderPage with title="插件设置" renders', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlaceholderPage, {
        title: '插件设置',
        phaseLabel: 'Phase 5-P',
      }),
    );

    assert.match(html, /插件设置/);
  });

  it('AboutPage renders with data-testid', () => {
    const html = renderToStaticMarkup(React.createElement(AboutPage));

    assert.match(html, /data-testid="settings-about-page"/);
  });

  it('SETTINGS_PAGES has exactly 7 entries', () => {
    assert.equal(SETTINGS_PAGES.length, 7);
  });
});
