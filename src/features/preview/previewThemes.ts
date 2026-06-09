/*
  Preview themes inspired by the mweb-themes ecosystem.
  Re-exports from the structured MWeb Theme Registry.
  Source: https://github.com/imageslr/mweb-themes (ISC License)
*/

import { MWEB_THEME_NAMES, MWEB_THEME_LABELS, isMWebTheme } from './themes/registry';
import type { MWebTheme } from './themes/registry';

export const PREVIEW_THEMES = [
  'github',
  'medium',
  'whitey',
  'pixyll',
  'newsprint',
  'tomorrow',
  'solarized-light',
  'greenery',
  'm-book',
  'typo',
  'vue',
  'lark',
  'bear-default',
  'dracula',
  'night',
  'spacegray',
  'gotham',
  'cobalt',
  'solarized-dark',
  'charcoal',
  'olive-dunk',
  'mercury',
  'm-web',
] as const;

export type PreviewTheme = (typeof PREVIEW_THEMES)[number];

export const DEFAULT_PREVIEW_THEME: PreviewTheme = 'typo';

const LS_KEY = 'schola.previewTheme';

export function readStoredTheme(): PreviewTheme {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw && isPreviewTheme(raw)) {
      return raw;
    }
    return DEFAULT_PREVIEW_THEME;
  } catch {
    return DEFAULT_PREVIEW_THEME;
  }
}

export function writeStoredTheme(theme: PreviewTheme): void {
  try {
    localStorage.setItem(LS_KEY, theme);
  } catch {
    // Storage may be unavailable (incognito, quota)
  }
}

function isPreviewTheme(value: string): value is PreviewTheme {
  return (PREVIEW_THEMES as readonly string[]).includes(value);
}

export const THEME_LABELS: Record<PreviewTheme, string> = {
  github: 'GitHub',
  medium: 'Medium',
  whitey: 'Whitey',
  pixyll: 'Pixyll',
  newsprint: 'Newsprint',
  tomorrow: 'Tomorrow',
  'solarized-light': 'Solarized Light',
  greenery: 'Greenery',
  'm-book': 'M-Book',
  typo: 'Typo',
  vue: 'Vue',
  lark: 'Lark',
  'bear-default': 'Bear',
  dracula: 'Dracula',
  night: 'Night',
  spacegray: 'Spacegray',
  gotham: 'Gotham',
  cobalt: 'Cobalt',
  'solarized-dark': 'Solarized Dark',
  charcoal: 'Charcoal',
  'olive-dunk': 'Olive Dunk',
  mercury: 'Mercury',
  'm-web': 'M-Web',
};
