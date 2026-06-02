import { Platform } from 'react-native';
import { createContext, useContext, useMemo } from 'react';

// Microsoft To Do (desktop) inspired themes.
export const darkColors = {
  bg: '#1f1f1f',          // main content background
  surface: '#2c2c2c',     // rows / cards / add bar
  surfaceAlt: '#383838',  // subtle fill / hover
  border: '#3a3a3a',      // hairline separators
  sidebar: '#1a1a1a',     // sidebar background
  sidebarActive: '#2c2c2c', // selected nav item
  text: '#ffffff',        // primary text
  textDim: '#c8c8c8',     // secondary text
  textFaint: '#8a8a8a',   // tertiary / placeholders
  primary: '#2899f5',     // To Do accent blue
  primaryDim: '#24405c',
  success: '#6ccb5f',     // completed green
  warning: '#ffb454',
  danger: '#ff6b6b',
  star: '#ffd34d',
  white: '#ffffff',
  onAccent: '#ffffff',
};

export type Palette = typeof darkColors;

export const lightColors: Palette = {
  bg: '#faf9f8',
  surface: '#ffffff',
  surfaceAlt: '#f0eff0',
  border: '#e1dfdd',
  sidebar: '#f3f2f1',
  sidebarActive: '#e7e6e5',
  text: '#1b1a19',
  textDim: '#4b4a48',
  textFaint: '#8a8886',
  primary: '#2564cf',
  primaryDim: '#cfe0fb',
  success: '#4a9c3f',
  warning: '#bd6f00',
  danger: '#d13438',
  star: '#d9a300',
  white: '#ffffff',
  onAccent: '#ffffff',
};

export type ThemeMode = 'system' | 'light' | 'dark';

// Active palette is provided via context so styles can rebuild on theme change.
export const ThemeContext = createContext<Palette>(darkColors);

/** Current theme palette. Use inside components for JSX color values. */
export function useTheme(): Palette {
  return useContext(ThemeContext);
}

/**
 * Build a StyleSheet from the active palette, memoized per theme. Define styles
 * as `const makeStyles = (colors: Palette) => StyleSheet.create({ ... })` and call
 * `const styles = useThemedStyles(makeStyles)` inside the component.
 */
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const colors = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}


export const priorityColor: Record<string, string> = {
  low: '#6ccb5f',
  medium: '#ffb454',
  high: '#ff6b6b',
};

// Per-list accent colors (used for icons / list theming on dark)
export interface ListTheme {
  key: string;
  accent: string;
  gradient: [string, string];
}

export const listThemes: Record<string, ListTheme> = {
  myday: { key: 'myday', accent: '#6ca0ff', gradient: ['#2b3a8f', '#3f6fd1'] },
  important: { key: 'important', accent: '#ff7a93', gradient: ['#7a1f3d', '#c0405f'] },
  planned: { key: 'planned', accent: '#4fd1c5', gradient: ['#0f5c5c', '#2a9d9d'] },
  tasks: { key: 'tasks', accent: '#6fd08c', gradient: ['#1f5235', '#3f8a5e'] },
  calendar: { key: 'calendar', accent: '#a78bfa', gradient: ['#3f3490', '#6f5fd0'] },
  learning: { key: 'learning', accent: '#f0b357', gradient: ['#7a4416', '#c1791f'] },
  search: { key: 'search', accent: '#9aa4b2', gradient: ['#374151', '#6b7280'] },
  stats: { key: 'stats', accent: '#6ca0ff', gradient: ['#1f3f8f', '#3a6fd1'] },
  log: { key: 'log', accent: '#ff7a93', gradient: ['#8a2342', '#c25b6e'] },
  motivation: { key: 'motivation', accent: '#f5c542', gradient: ['#8a6a16', '#d1a83f'] },
  settings: { key: 'settings', accent: '#9aa4b2', gradient: ['#374151', '#6b7280'] },
};

export const CATEGORY_COLORS = [
  '#2899f5',
  '#6ccb5f',
  '#ffb454',
  '#ff6b6b',
  '#b18cff',
  '#3fd0c9',
  '#ff7ac3',
  '#9bd45a',
];

export const fontFamily = Platform.select({
  web: '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
  default: undefined,
}) as string | undefined;

export const spacing = (n: number) => n * 8;

export const radius = { sm: 6, md: 8, lg: 12, pill: 999 };

export const shadow: any = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(0,0,0,0.25)' },
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  default: { elevation: 1 },
});
