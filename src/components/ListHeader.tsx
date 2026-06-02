import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { spacing, fontFamily, listThemes, useTheme, useThemedStyles, Palette } from '../theme';

export function ListHeader({
  themeKey,
  icon,
  title,
  subtitle,
  count,
  onBack,
  right,
}: {
  themeKey: string;
  icon?: string;
  title: string;
  subtitle?: string;
  count?: number;
  onBack?: () => void;
  right?: React.ReactNode;
  gradient?: [string, string];
}) {
  const styles = useThemedStyles(makeStyles);
  const theme = listThemes[themeKey] ?? listThemes.tasks;
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        ) : null}
        <View style={styles.titleRow}>
          {icon ? <Text style={[styles.icon, { color: theme.accent }]}>{icon}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: {
    paddingTop: spacing(2),
    paddingBottom: spacing(1.5),
    paddingHorizontal: spacing(3),
  },
  topRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  back: { paddingRight: spacing(1), marginLeft: -spacing(1) },
  backText: { color: colors.text, fontSize: 30, lineHeight: 30, fontWeight: '300' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  icon: { fontSize: 22, marginRight: spacing(1) },
  title: { color: colors.text, fontSize: 30, fontWeight: '600', fontFamily, letterSpacing: 0.2 },
  subtitle: { color: colors.textDim, fontSize: 13, marginTop: spacing(0.5), fontFamily, marginLeft: spacing(0.25) },
});
