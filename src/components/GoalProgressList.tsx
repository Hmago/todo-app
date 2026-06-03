import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, spacing, fontFamily, useTheme, useThemedStyles, Palette } from '../theme';
import { LearningGoal } from '../types';
import { goalProgress, GoalStatus, GOAL_STATUS_LABEL } from '../lib/analytics';
import { prettyDate } from '../lib/dates';

function daysLeftLabel(daysLeft: number | null): string {
  if (daysLeft == null) return '';
  if (daysLeft === 0) return 'due today';
  if (daysLeft > 0) return `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;
  const past = Math.abs(daysLeft);
  return `${past} day${past === 1 ? '' : 's'} overdue`;
}

function statusColors(colors: Palette, status: GoalStatus): { bg: string; fg: string; fill: string } {
  switch (status) {
    case 'complete':
      return { bg: colors.success + '22', fg: colors.success, fill: colors.success };
    case 'ahead':
      return { bg: colors.primary + '22', fg: colors.primary, fill: colors.primary };
    case 'on-track':
      return { bg: colors.success + '1f', fg: colors.success, fill: colors.success };
    case 'behind':
      return { bg: colors.warning + '22', fg: colors.warning, fill: colors.warning };
    case 'overdue':
      return { bg: colors.danger + '22', fg: colors.danger, fill: colors.danger };
    case 'no-target':
    default:
      return { bg: colors.surfaceAlt, fg: colors.textDim, fill: colors.textDim };
  }
}

export function GoalProgressRow({ goal }: { goal: LearningGoal }) {
  const colors = useTheme();
  const styles = useThemedStyles(makeStyles);
  const p = goalProgress(goal);
  const sc = statusColors(colors, p.status);
  const ratioPct = Math.round(p.ratio * 100);
  const expectedPct = p.expected != null ? Math.round(p.expected * 100) : null;

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {goal.title}
        </Text>
        <View style={[styles.pill, { backgroundColor: sc.bg }]}>
          <Text style={[styles.pillText, { color: sc.fg }]}>{GOAL_STATUS_LABEL[p.status]}</Text>
        </View>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.max(0, Math.min(100, ratioPct))}%`, backgroundColor: sc.fill },
          ]}
        />
        {expectedPct != null ? (
          <View
            style={[
              styles.marker,
              {
                left: `${Math.max(0, Math.min(100, expectedPct))}%`,
                backgroundColor: colors.text,
              },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>
          {p.done}/{p.total} milestone{p.total === 1 ? '' : 's'} · {ratioPct}%
          {expectedPct != null ? `  ·  expected ${expectedPct}%` : ''}
        </Text>
        <Text style={styles.metaText}>
          {goal.targetDate ? `Due ${prettyDate(goal.targetDate)} · ${daysLeftLabel(p.daysLeft)}` : 'No target date'}
        </Text>
      </View>
    </View>
  );
}

export function GoalProgressList({ goals }: { goals: LearningGoal[] }) {
  const styles = useThemedStyles(makeStyles);
  if (goals.length === 0) {
    return <Text style={styles.empty}>Add a learning goal to track progress against a target.</Text>;
  }
  const sorted = [...goals].sort((a, b) => {
    // Pull overdue/behind to the top, then no-target to the bottom, otherwise by target date.
    const rank: Record<GoalStatus, number> = {
      overdue: 0,
      behind: 1,
      'on-track': 2,
      ahead: 3,
      complete: 4,
      'no-target': 5,
    };
    const ra = rank[goalProgress(a).status];
    const rb = rank[goalProgress(b).status];
    if (ra !== rb) return ra - rb;
    return (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999');
  });
  return (
    <View>
      {sorted.map((g) => (
        <GoalProgressRow key={g.id} goal={g} />
      ))}
      <View style={styles.legendRow}>
        <View style={styles.legendDash} />
        <Text style={styles.legendText}>Marker = expected progress by today</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    row: {
      marginBottom: spacing(1.5),
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
    pill: {
      paddingVertical: 2,
      paddingHorizontal: spacing(1),
      borderRadius: radius.pill,
    },
    pillText: { fontSize: 11, fontWeight: '800', fontFamily },
    track: {
      height: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceAlt,
      overflow: 'visible',
      position: 'relative',
    },
    fill: {
      height: 8,
      borderRadius: radius.pill,
    },
    marker: {
      position: 'absolute',
      top: -2,
      width: 2,
      height: 12,
      borderRadius: 1,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing(0.5),
      flexWrap: 'wrap',
      gap: spacing(1),
    },
    metaText: { color: colors.textDim, fontSize: 12, fontFamily },
    empty: { color: colors.textDim, fontSize: 13, fontFamily },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing(0.5),
    },
    legendDash: {
      width: 2,
      height: 10,
      backgroundColor: colors.text,
      marginRight: 6,
      borderRadius: 1,
    },
    legendText: { color: colors.textFaint, fontSize: 11, fontFamily, fontStyle: 'italic' },
  });
