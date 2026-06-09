import { useCallback } from 'react';
import type { ChangeEvent, ReactElement } from 'react';
import { THEME_LABELS, isGlobalTheme, type AppTheme } from './appThemes';
import { useTheme } from './useTheme';

export interface AppThemeSelectorProps {
  readonly value?: AppTheme;
  readonly onChange?: (theme: AppTheme) => void;
}

export function AppThemeSelector({ value, onChange }: AppThemeSelectorProps = {}): ReactElement {
  const { globalTheme, setGlobalTheme, availableThemes } = useTheme();
  const selectedTheme = value ?? globalTheme;

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>): void => {
      const next = e.target.value;
      if (isGlobalTheme(next)) {
        setGlobalTheme(next);
        onChange?.(next);
      }
    },
    [onChange, setGlobalTheme],
  );

  return (
    <div className="app-theme-selector">
      <label className="app-theme-label" htmlFor="app-theme-select">
        全局主题
      </label>
      <select
        id="app-theme-select"
        className="app-theme-select"
        data-testid="app-theme-selector"
        value={selectedTheme}
        onChange={handleChange}
      >
        {availableThemes.map((theme) => (
          <option key={theme} value={theme}>
            {THEME_LABELS[theme]}
          </option>
        ))}
      </select>
    </div>
  );
}
