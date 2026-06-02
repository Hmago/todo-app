import { Platform } from 'react-native';

// Microsoft To Do (desktop) inspired dark theme
export const colors = {
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
