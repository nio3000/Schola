import { useContext } from 'react';
import type { ThemeContextValue, ScholaTheme } from './ThemeProvider';
import { ThemeContext } from './ThemeProvider';

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider.');
  }
  return context;
}

export type { ScholaTheme };
