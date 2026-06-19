import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing, fontFamily, useTheme, useThemedStyles, Palette } from '../theme';
import { HabitStat, HabitDay } from '../lib/analytics';
import { recurrenceLabel } from '../lib/recurrence';
import { prettyDate } from '../lib/dates';

/** Progress-bar / summary colour by adherence. Grey when nothing has resolved. */
function rateColor(colors: Palette, rate: number, resolved: number): string {
  if (resolved === 0) return colors.textFaint;
  if (rate >= 0.8) return colors.success;
  if (rate >= 0.5) return colors.warning;
  return colors.danger;
}

export function HabitAdherenceRow({ habit }: { habit: HabitStat }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { task } = habit;
  const resolved = habit.done + habit.missed;
  const denom = resolved || habit.expected;
  const pct = Math.round(habit.rate * 100);
  const fill = rateColor(colors, habit.rate, resolved);
  const label = recurrenceLabel(task) || 'Repeats';

  const dotColor = (d: HabitDay): string => {
    if (d.status === 'completed') return colors.success;
    if (d.status === 'skipped') return colors.textFaint;
    if (d.isToday) return colors.primary;
    return colors.danger;
  };

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {task.title}
        </Text>
        <View style={[styles.streakPill, { backgroundColor: colors.warning + '22' }]}>
          <Text style={[styles.streakText, { color: colors.warning }]}>🔥 {habit.currentStreak}</Text>
        </View>
      </View>

      <View style={styles.subRow}>
        <View style={styles.recurPill}>
          <Text style={styles.recurText}>{label}</Text>
        </View>
        <Text style={styles.subMeta}>best streak {habit.longestStreak}</Text>
      </View>

      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: fill }]}
        />
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.metaStrong, { color: fill }]}>
          followed {habit.done}/{denom} · {pct}%
        </Text>
        <Text style={styles.metaText}>
          {habit.missed > 0 ? `${habit.missed} missed` : 'none missed'}
          {habit.skipped > 0 ? ` · ${habit.skipped} skipped` : ''}
          {habit.pendingToday ? ' · due today' : ''}
        </Text>
      </View>

      {habit.recent.length > 0 ? (
        <View style={styles.strip}>
          {habit.recent.map((d) => (
            <View key={d.key} style={[styles.dotCell, { backgroundColor: dotColor(d) }]} />
          ))}
        </View>
      ) : null}

      <Text style={styles.lastDone}>
        {habit.lastDone ? `Last done ${prettyDate(habit.lastDone)}` : 'Not completed yet in range'}
      </Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

export function HabitAdherenceList({ habits }: { habits: HabitStat[] }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (habits.length === 0) {
    return (
      <Text style={styles.empty}>
        No recurring tasks in this range. Set a task to repeat (daily, weekly or custom) to track how
        consistently you follow it here.
      </Text>
    );
  }
  return (
    <View>
      {habits.map((h) => (
        <HabitAdherenceRow key={h.task.id} habit={h} />
      ))}
      <View style={styles.legendRow}>
        <LegendDot color={colors.success} label="done" />
        <LegendDot color={colors.danger} label="missed" />
        <LegendDot color={colors.textFaint} label="skipped" />
        <LegendDot color={colors.primary} label="today" />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      marginBottom: spacing(2),
      paddingBottom: spacing(1.5),
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing(0.5),
    },
    title: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      fontFamily,
      flexShrink: 1,
      marginRight: spacing(1),
    },
    streakPill: { paddingVertical: 2, paddingHorizontal: spacing(1), borderRadius: radius.pill },
    streakText: { fontSize: 12, fontWeight: '800', fontFamily },
    subRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing(0.75), gap: spacing(1) },
    recurPill: {
      paddingVertical: 1,
      paddingHorizontal: spacing(1),
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
    },
    recurText: { color: colors.textDim, fontSize: 11, fontWeight: '700', fontFamily },
    subMeta: { color: colors.textFaint, fontSize: 11, fontFamily },
    track: {
      height: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
      overflow: 'hidden',
    },
    fill: { height: 8, borderRadius: radius.pill },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing(0.5),
      flexWrap: 'wrap',
      gap: spacing(1),
    },
    metaStrong: { fontSize: 12, fontWeight: '800', fontFamily },
    metaText: { color: colors.textDim, fontSize: 12, fontFamily },
    strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: spacing(1) },
    dotCell: { width: 12, height: 12, borderRadius: 3 },
    lastDone: { color: colors.textFaint, fontSize: 11, fontFamily, marginTop: spacing(0.75) },
    empty: { color: colors.textDim, fontSize: 13, fontFamily },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5), marginTop: spacing(0.5) },
    legendItem: { flexDirection: 'row', alignItems: 'center' },
    legendDot: { width: 10, height: 10, borderRadius: 3, marginRight: 5 },
    legendText: { color: colors.textFaint, fontSize: 11, fontFamily },
  });
