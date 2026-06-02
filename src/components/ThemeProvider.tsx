import React from 'react';
import { useColorScheme } from 'react-native';
import { ThemeContext, darkColors, lightColors, Palette } from '../theme';
import { useThemePref } from '../store/useThemePref';

/** Resolves the active palette from the user's preference + OS appearance. */
export function useResolvedTheme(): { colors: Palette; isDark: boolean } {
  const mode = useThemePref((s) => s.mode);
  const system = useColorScheme();
  const isDark = mode === 'system' ? system !== 'light' : mode === 'dark';
  return { colors: isDark ? darkColors : lightColors, isDark };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useResolvedTheme();
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}
