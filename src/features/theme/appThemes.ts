/*
  Schola application shell themes.

  These control the look of the app chrome (sidebar, tabs, status bar, etc.)
  and are completely separate from mweb-themes / data-preview-theme which
  control the Markdown preview content area.

  Each theme is a set of CSS custom property overrides applied via a
  [data-app-theme="..."] attribute on the <html> element.  The variable
  names are the same across all themes so that every component references
  the same tokens — only the values change.

  Phase 5-DEV-WORKSPACE-GLOBAL-THEME-MENUBAR-PRIMER-R6-R5:
  GitHub Dark / Dark Dimmed / Light themes from primer/github-vscode-theme (MIT license).
  Source: https://github.com/primer/github-vscode-theme
*/

export const GLOBAL_THEMES = [
  'github-dark',
  'github-dark-dimmed',
  'github-light',
  'schola-dark',
  'schola-light',
  'schola-academic-dark',
  'schola-high-contrast',
  'neutral-dark',
  'warm-dark',
  'deep-dark',
  'light',
  'paper',
] as const;

export type GlobalTheme = (typeof GLOBAL_THEMES)[number];
export type AppTheme = GlobalTheme;

export const DEFAULT_GLOBAL_THEME: GlobalTheme = 'github-dark';
export const DEFAULT_APP_THEME: AppTheme = DEFAULT_GLOBAL_THEME;

const LS_KEY = 'schola.appTheme';

export function isGlobalTheme(value: string): value is GlobalTheme {
  return (GLOBAL_THEMES as readonly string[]).includes(value);
}

export function readStoredAppTheme(): AppTheme {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw && isGlobalTheme(raw)) {
      return raw;
    }
    return DEFAULT_APP_THEME;
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export function writeStoredAppTheme(theme: AppTheme): void {
  try {
    localStorage.setItem(LS_KEY, theme);
  } catch {
    // Storage may be unavailable (incognito, quota)
  }
}

export const THEME_LABELS: Record<GlobalTheme, string> = {
  'github-dark': 'GitHub Dark',
  'github-dark-dimmed': 'GitHub Dark Dimmed',
  'github-light': 'GitHub Light',
  'schola-dark': 'Schola Dark',
  'schola-light': 'Schola Light',
  'schola-academic-dark': 'Academic Dark',
  'schola-high-contrast': 'High Contrast',
  'neutral-dark': 'Neutral Dark',
  'warm-dark': 'Warm Dark',
  'deep-dark': 'Deep Dark',
  light: 'Light',
  paper: 'Paper',
};
