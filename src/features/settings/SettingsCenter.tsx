/**
 * SettingsCenter — main container for the Settings Center.
 *
 * Layout: left nav (SettingsNav) + right content area (page components).
 * Uses activePage state from useSettings hook.
 *
 * Replaces SettingsPlaceholder in Phase 5-1.
 *
 * Key invariants:
 * - Left nav is fixed-width, right content scrolls
 * - Each page component receives relevant data from useSettings
 * - Handles loading/error states
 */

import type { ReactElement } from 'react';
import type { SettingsPageId } from '../../lib/contracts/settings.types';
import { useSettings } from './hooks/useSettings';
import { SettingsNav } from './components/SettingsNav';
import { GeneralPage } from './components/GeneralPage';
import { AIPage } from './components/AIPage';
import { ProviderPage } from './components/ProviderPage';
import { PrivacyPage } from './components/PrivacyPage';
import { AboutPage } from './components/AboutPage';
import { PlaceholderPage } from './components/PlaceholderPage';

function renderPage(
  pageId: SettingsPageId,
  state: ReturnType<typeof useSettings>,
): ReactElement {
  switch (pageId) {
    case 'general':
      return <GeneralPage />;
    case 'ai':
      return <AIPage aiPrefs={state.aiPrefs} presets={state.providerPresets} configs={state.providerConfigs} keyStatuses={state.keyStatuses} onRefresh={state.refreshData} />;
    case 'provider':
      return (
        <ProviderPage
          presets={state.providerPresets}
          configs={state.providerConfigs}
          keyStatuses={state.keyStatuses}
          onRefresh={state.refreshData}
        />
      );
    case 'privacy':
      return (
        <PrivacyPage
          privacyConsent={state.privacyConsent}
          confirmationLog={state.confirmationLog}
        />
      );
    case 'model':
      return (
        <PlaceholderPage title="Model 设置" phaseLabel="后续完成" />
      );
    case 'export':
      return (
        <PlaceholderPage title="导出设置" phaseLabel="后续完成" />
      );
    case 'plugin':
      return (
        <PlaceholderPage title="插件设置" phaseLabel="后续完成" />
      );
    case 'about':
      return <AboutPage />;
    default:
      return <GeneralPage />;
  }
}

export function SettingsCenter(): ReactElement {
  const state = useSettings();

  return (
    <div className="settings-center" data-testid="settings-center">
      <SettingsNav
        activePage={state.activePage}
        onPageChange={state.setActivePage}
      />
      <div className="settings-content-area" data-testid="settings-content-area">
        {state.loading ? (
          <div className="settings-loading" data-testid="settings-loading">
            <p>加载设置...</p>
          </div>
        ) : state.error ? (
          <div className="settings-error" data-testid="settings-error">
            <p>{state.error}</p>
            <button
              type="button"
              className="settings-btn settings-btn-secondary"
              onClick={state.refreshData}
            >
              重试
            </button>
          </div>
        ) : (
          renderPage(state.activePage, state)
        )}
      </div>
    </div>
  );
}
