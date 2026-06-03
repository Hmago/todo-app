import React from 'react';
import { Platform, TextInput, StyleProp, TextStyle } from 'react-native';
import { useTheme, radius, spacing, fontFamily } from '../theme';
import { useResolvedTheme } from './ThemeProvider';

interface Props {
  mode: 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest selectable date (yyyy-mm-dd), date mode only. */
  min?: string;
  /** Web only: extra style applied to the underlying input. */
  style?: StyleProp<TextStyle>;
}

/**
 * A themed date/time field. On web it renders the browser's native
 * `<input type="date|time">` so users get a real calendar / clock picker.
 * On native it falls back to a plain text field (yyyy-mm-dd / HH:mm).
 */
export function DateTimeField({ mode, value, onChange, placeholder, min, style }: Props) {
  const colors = useTheme();
  const { isDark } = useResolvedTheme();

  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: mode,
      value: value || '',
      min,
      onChange: (e: any) => onChange(e.target.value),
      style: {
        boxSizing: 'border-box',
        width: '100%',
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.md,
        padding: `${spacing(1.25)}px ${spacing(1.5)}px`,
        color: colors.text,
        fontSize: 16,
        fontFamily,
        marginBottom: spacing(1),
        outline: 'none',
        // Themes the native picker UI (calendar icon + popup).
        colorScheme: isDark ? 'dark' : 'light',
      },
    });
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder ?? (mode === 'date' ? 'yyyy-mm-dd' : 'HH:mm')}
      placeholderTextColor={colors.textDim}
      autoCapitalize="none"
      style={style}
    />
  );
}
