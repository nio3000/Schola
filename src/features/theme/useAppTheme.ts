import type { AppTheme } from './appThemes';
import { DEFAULT_APP_THEME } from './appThemes';
import { useTheme } from './useTheme';

/**
 * Manages the Schola application shell theme.
 *
 * On mount the theme is read from localStorage.  Calling setTheme() updates
 * state, persists to localStorage, and sets the data-app-theme attribute on
 * <html> so that CSS variable overrides take effect immediately.
 */
export function useAppTheme(): readonly [AppTheme, (theme: AppTheme) => void] {
  const { globalTheme, setGlobalTheme } = useTheme();
  return [globalTheme, setGlobalTheme];
}

export { DEFAULT_APP_THEME };
export type { AppTheme };
