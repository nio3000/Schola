/**
 * MWeb Theme Registry
 *
 * Structured registry of 23 MWeb preview/editor themes.
 * Source: https://github.com/imageslr/mweb-themes (ISC License)
 * License: ISC — see docs/licenses/mweb-themes-ISC-license.md
 *
 * Each theme is self-contained in its own CSS file under themes/.
 * The aggregate import is at themes/index.css.
 */

export const MWEB_THEME_NAMES = [
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

export type MWebTheme = (typeof MWEB_THEME_NAMES)[number];

export const MWEB_THEME_LABELS: Record<MWebTheme, string> = {
  github: 'GitHub', medium: 'Medium', whitey: 'Whitey', pixyll: 'Pixyll',
  newsprint: 'Newsprint', tomorrow: 'Tomorrow', 'solarized-light': 'Solarized Light',
  greenery: 'Greenery', 'm-book': 'M-Book', typo: 'Typo', vue: 'Vue',
  lark: 'Lark', 'bear-default': 'Bear', dracula: 'Dracula', night: 'Night',
  spacegray: 'Spacegray', gotham: 'Gotham', cobalt: 'Cobalt',
  'solarized-dark': 'Solarized Dark', charcoal: 'Charcoal', 'olive-dunk': 'Olive Dunk',
  mercury: 'Mercury', 'm-web': 'M-Web',
};

export const MWEB_THEME_LIGHT: readonly MWebTheme[] = [
  'github', 'medium', 'whitey', 'pixyll', 'newsprint', 'tomorrow',
  'solarized-light', 'greenery', 'm-book', 'vue', 'lark', 'bear-default',
];

export const MWEB_THEME_DARK: readonly MWebTheme[] = [
  'typo', 'dracula', 'night', 'spacegray', 'gotham', 'cobalt',
  'solarized-dark', 'charcoal', 'olive-dunk', 'mercury', 'm-web',
];

export function isMWebTheme(value: string): value is MWebTheme {
  return (MWEB_THEME_NAMES as readonly string[]).includes(value);
}
