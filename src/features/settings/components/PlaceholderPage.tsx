/**
 * PlaceholderPage — reusable placeholder for unimplemented settings pages.
 *
 * Displays a title and a follow-up completion message.
 * Used for: export, plugin pages (and any future placeholder pages).
 *
 * Key invariants:
 * - Read-only: no buttons, no inputs, no toggles
 * - Clear messaging: user knows this is a future feature
 * - Consistent with existing Schola dark theme
 */

import type { ReactElement } from 'react';

export interface PlaceholderPageProps {
  readonly title: string;
  readonly phaseLabel: string;
}

export function PlaceholderPage({
  title,
  phaseLabel,
}: PlaceholderPageProps): ReactElement {
  return (
    <div className="settings-page-placeholder" data-testid={`settings-placeholder-${phaseLabel.replace(/\s+/g, '-').toLowerCase()}`}>
      <span className="settings-page-placeholder-icon">{'\uD83D\uDEA7'}</span>
      <h2 className="settings-page-placeholder-title">{title}</h2>
      <p className="settings-page-placeholder-phase">后续完成</p>
      <p className="settings-page-placeholder-desc">
        该能力将在后续完成。
      </p>
    </div>
  );
}
