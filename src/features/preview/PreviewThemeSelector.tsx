import { useCallback } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import { type PreviewTheme, PREVIEW_THEMES, THEME_LABELS } from './previewThemes';

export interface PreviewThemeSelectorProps {
  readonly value: PreviewTheme;
  readonly onChange: (theme: PreviewTheme) => void;
}

export function PreviewThemeSelector({ value, onChange }: PreviewThemeSelectorProps): ReactElement {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>): void => {
      const theme = e.target.value;
      if (PREVIEW_THEMES.includes(theme as PreviewTheme)) {
        onChange(theme as PreviewTheme);
      }
    },
    [onChange],
  );

  return (
    <div className="preview-theme-selector">
      <label className="preview-theme-label" htmlFor="preview-theme-select">
        Theme
      </label>
      <select
        id="preview-theme-select"
        className="preview-theme-select"
        data-testid="preview-theme-select"
        value={value}
        onChange={handleChange}
      >
        {PREVIEW_THEMES.map((theme) => (
          <option key={theme} value={theme}>
            {THEME_LABELS[theme]}
          </option>
        ))}
      </select>
    </div>
  );
}
