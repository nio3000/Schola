import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  DEFAULT_GLOBAL_THEME,
  GLOBAL_THEMES,
  isGlobalTheme,
  type GlobalTheme,
} from './appThemes';

export const SCHOLA_THEMES = GLOBAL_THEMES;
export type ScholaTheme = GlobalTheme;
export type SetScholaTheme = (theme: ScholaTheme) => void;
export type SetGlobalTheme = (theme: GlobalTheme) => void;

export const DEFAULT_SCHOLA_THEME: ScholaTheme = DEFAULT_GLOBAL_THEME;
export const SCHOLA_THEME_STORAGE_KEY = 'schola.theme';
const LEGACY_APP_THEME_STORAGE_KEY = 'schola.appTheme';

/*
 * Historical aliases kept because older tests and components import these
 * names. The runtime now has one global theme source of truth.
 */
export const LEGACY_SCHOLA_THEMES = [
  'github-dark',
  'github-dark-dimmed',
  'github-light',
  'schola-dark',
  'schola-light',
  'schola-academic-dark',
  'schola-high-contrast',
] as const;

export interface ThemeContextValue {
  readonly theme: GlobalTheme;
  readonly globalTheme: GlobalTheme;
  readonly setTheme: SetScholaTheme;
  readonly setGlobalTheme: SetGlobalTheme;
  readonly availableThemes: readonly GlobalTheme[];
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly children: ReactNode;
}

export function isScholaTheme(value: string): value is ScholaTheme {
  return isGlobalTheme(value);
}

function readStoredTheme(): GlobalTheme {
  try {
    const storedTheme = localStorage.getItem(SCHOLA_THEME_STORAGE_KEY);
    if (storedTheme && isGlobalTheme(storedTheme)) {
      return storedTheme;
    }

    const legacyAppTheme = localStorage.getItem(LEGACY_APP_THEME_STORAGE_KEY);
    if (legacyAppTheme && isGlobalTheme(legacyAppTheme)) {
      return legacyAppTheme;
    }

    return DEFAULT_GLOBAL_THEME;
  } catch {
    return DEFAULT_GLOBAL_THEME;
  }
}

function writeStoredTheme(theme: GlobalTheme): void {
  try {
    localStorage.setItem(SCHOLA_THEME_STORAGE_KEY, theme);
    localStorage.setItem(LEGACY_APP_THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function applyTheme(theme: GlobalTheme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-app-theme', theme);
}

export function ThemeProvider({ children }: ThemeProviderProps): ReactElement {
  const [theme, setThemeState] = useState<GlobalTheme>(readStoredTheme);

  const setGlobalTheme = useCallback((nextTheme: GlobalTheme): void => {
    setThemeState(nextTheme);
    writeStoredTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const setTheme = useCallback<SetScholaTheme>(
    (nextTheme) => {
      setGlobalTheme(nextTheme);
    },
    [setGlobalTheme],
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      globalTheme: theme,
      setTheme,
      setGlobalTheme,
      availableThemes: SCHOLA_THEMES,
    }),
    [theme, setGlobalTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
