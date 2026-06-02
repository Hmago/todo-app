import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { radius, spacing, fontFamily, shadow, useTheme, useThemedStyles, Palette } from '../theme';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemedStyles(makeStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  style,
  small,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const bg =
    variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  const border = variant === 'ghost' ? colors.border : 'transparent';
  const txt = variant === 'ghost' ? colors.text : colors.white;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === 'ghost' ? 1 : 0, opacity: pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: txt }, small && { fontSize: 13 }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: colors.border },
        active && { backgroundColor: (color ?? colors.primary) + '22', borderColor: color ?? colors.primary },
      ]}
    >
      {color && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.chipText, active && { color: color ?? colors.primary, fontWeight: '700' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color ?? colors.primary }]} />
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.empty}>
      {icon ? <Text style={styles.emptyIcon}>{icon}</Text> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(1),
    marginTop: spacing(1),
  },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', fontFamily },
  btn: {
    paddingVertical: spacing(1.25),
    paddingHorizontal: spacing(2.5),
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: spacing(0.75), paddingHorizontal: spacing(1.5) },
  btnText: { fontWeight: '600', fontSize: 15, fontFamily },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.surface,
    marginRight: spacing(1),
    marginBottom: spacing(1),
  },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600', fontFamily },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: radius.pill },
  empty: { alignItems: 'center', padding: spacing(5) },
  emptyIcon: { fontSize: 40, marginBottom: spacing(1) },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '600', fontFamily },
  emptySub: { color: colors.textDim, fontSize: 13, marginTop: 4, textAlign: 'center', fontFamily },
  label: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginBottom: spacing(1), fontFamily },
});
