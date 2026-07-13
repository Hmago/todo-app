import React, { useMemo, useState } from 'react';
import {
  Platform,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleProp,
  TextStyle,
  StyleSheet,
} from 'react-native';
import { useTheme, radius, spacing, fontFamily, useThemedStyles, Palette } from '../theme';
import { useResolvedTheme } from './ThemeProvider';
import { AppModal } from './AppModal';

/** Granularity of the time dropdown, in minutes. */
const STEP_MINUTES = 15;

/** Build a full day of 'HH:mm' options at STEP_MINUTES granularity. Any valid
 *  off-grid `extra` value (e.g. legacy 09:07) is merged in so it stays selectable. */
function buildOptions(extra?: string): string[] {
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += STEP_MINUTES) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  if (extra && /^\d{2}:\d{2}$/.test(extra) && !out.includes(extra)) {
    out.push(extra);
    out.sort();
  }
  return out;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Shown when no time is selected. */
  placeholder?: string;
  /** Extra style applied to the underlying control (web + native). */
  style?: StyleProp<TextStyle>;
}

/**
 * A themed time picker rendered as a dropdown of `HH:mm` options.
 * On web it renders a native `<select>`; on native it opens a scrollable
 * list of the same options in a modal.
 */
export function TimeSelect({ value, onChange, placeholder = '--:--', style }: Props) {
  const colors = useTheme();
  const { isDark } = useResolvedTheme();
  const options = useMemo(() => buildOptions(value), [value]);

  if (Platform.OS === 'web') {
    const extra = StyleSheet.flatten(style) as Record<string, any> | undefined;
    return React.createElement(
      'select',
      {
        value: value || '',
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
          colorScheme: isDark ? 'dark' : 'light',
          ...(extra ?? {}),
        },
      },
      [
        React.createElement('option', { key: '__empty', value: '' }, placeholder),
        ...options.map((t) => React.createElement('option', { key: t, value: t }, t)),
      ],
    );
  }

  return (
    <NativeTimeSelect
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      options={options}
      style={style}
    />
  );
}

function NativeTimeSelect({
  value,
  onChange,
  placeholder,
  options,
  style,
}: Props & { options: string[] }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);

  const select = (t: string) => {
    onChange(t);
    setOpen(false);
  };

  return (
    <>
      <Pressable style={[styles.field, style as any]} onPress={() => setOpen(true)}>
        <Text style={[styles.fieldText, !value && { color: colors.textDim }]}>
          {value || placeholder}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>
      <AppModal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView>
              {options.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.option, t === value && styles.optionActive]}
                  onPress={() => select(t)}
                >
                  <Text style={[styles.optionText, t === value && styles.optionTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </AppModal>
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing(1.5),
      paddingVertical: spacing(1.25),
      marginBottom: spacing(1),
    },
    fieldText: { color: colors.text, fontSize: 15, fontFamily },
    caret: { color: colors.textDim, fontSize: 12 },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      paddingHorizontal: spacing(4),
    },
    sheet: {
      backgroundColor: colors.bg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      maxHeight: '70%',
      overflow: 'hidden',
    },
    option: {
      paddingVertical: spacing(1.5),
      paddingHorizontal: spacing(2),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    optionActive: { backgroundColor: colors.primaryDim },
    optionText: { color: colors.text, fontSize: 16, fontFamily, textAlign: 'center' },
    optionTextActive: { color: colors.primary, fontWeight: '700' },
  });
