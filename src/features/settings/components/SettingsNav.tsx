/**
 * SettingsNav — vertical navigation menu for Settings Center.
 *
 * Renders all 7 settings pages from SETTINGS_PAGES, with active state
 * highlighting and click-to-navigate behavior.
 *
 * Key invariants:
 * - Imports SETTINGS_PAGES from contracts (source of truth)
 * - Active page determined by activePage prop
 * - Each nav item uses data-testid for testability
 */

import type { ReactElement } from 'react';
import {
  SETTINGS_PAGES,
  type SettingsPageId,
} from '../../../lib/contracts/settings.types';

export interface SettingsNavProps {
  readonly activePage: SettingsPageId;
  readonly onPageChange: (page: SettingsPageId) => void;
}

export function SettingsNav({
  activePage,
  onPageChange,
}: SettingsNavProps): ReactElement {
  return (
    <nav className="settings-nav" aria-label="设置导航" data-testid="settings-nav">
      <div className="settings-nav-header">
        <span className="settings-nav-header-icon">{'\u2699\uFE0F'}</span>
        <span className="settings-nav-header-text">设置</span>
      </div>
      <ul className="settings-nav-list">
        {SETTINGS_PAGES.map((page) => {
          const isActive = activePage === page.id;
          const isPlaceholder = page.phase === '5-1-placeholder';
          return (
            <li key={page.id} className="settings-nav-item">
              <button
                type="button"
                className={`settings-nav-link${isActive ? ' settings-nav-link-active' : ''}${isPlaceholder ? ' settings-nav-link-placeholder' : ''}`}
                data-testid={`settings-nav-${page.id}`}
                data-active={isActive ? 'true' : 'false'}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onPageChange(page.id)}
              >
                <span className="settings-nav-icon">{page.icon}</span>
                <span className="settings-nav-label">{page.label}</span>
                {isPlaceholder && (
                  <span className="settings-nav-badge" title="即将推出">
                    {'\uD83D\uDEA7'}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
