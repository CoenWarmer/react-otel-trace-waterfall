import { createContext, useContext } from 'react';
import { defaultTheme, type ThemeTokens } from './theme';

export const ThemeContext = createContext<ThemeTokens>(defaultTheme);

export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}
