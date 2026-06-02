import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, radius, spacing, fontFamily } from '../theme';
import { DayStat, activityLevel } from '../lib/analytics';
import { fromKey, prettyDate, prettyDuration } from '../lib/dates';
import { startOfWeek, format } from 'date-fns';

const LEVEL_COLORS = ['#2c2c2c', '#1f4d2e', '#2f7d43', '#46a35a', '#6fd08c'];
const CELL = 13;
const GAP = 3;

function HeatCell({ day, accent }: { day: DayStat | undefined; accent: string }) {
  const [hover, setHover] = useState(false);
  if (!day) return <View style={{ width: CELL, height: CELL, margin: GAP / 2 }} />;
  const level = activityLevel(day);
  const bg = LEVEL_COLORS[level];
  const tip = `${prettyDate(day.key)} · ${day.completed}/${day.scheduled} done${
    day.focusMin ? ` · ${prettyDuration(day.focusMin)} focus` : ''
  }`;
  return (
    <Pressable
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={[
        styles.cell,
        { backgroundColor: bg },
        level === 0 && styles.cellEmpty,
        hover && { borderColor: accent, borderWidth: 1 },
      ]}
    >
      {hover ? (
        <View style={styles.tooltip} pointerEvents="none">
          <Text style={styles.tooltipText}>{tip}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ActivityHeatmap({ days, accent = colors.success }: { days: DayStat[]; accent?: string }) {
  const { columns, monthLabels } = useMemo(() => {
    if (days.length === 0) return { columns: [] as (DayStat | undefined)[][], monthLabels: [] as { col: number; label: string }[] };
    const byKey = new Map(days.map((d) => [d.key, d]));
    const first = fromKey(days[0].key);
    const last = fromKey(days[days.length - 1].key);
    const gridStart = startOfWeek(first, { weekStartsOn: 0 });

    const cols: (DayStat | undefined)[][] = [];
    const labels: { col: number; label: string }[] = [];
    let cursor = new Date(gridStart);
    let col = 0;
    let lastMonth = -1;
    while (cursor <= last) {
      const column: (DayStat | undefined)[] = [];
      for (let r = 0; r < 7; r++) {
        const key = format(cursor, 'yyyy-MM-dd');
        const inRange = cursor >= first && cursor <= last;
        column.push(inRange ? byKey.get(key) ?? { key, scheduled: 0, completed: 0, focusMin: 0 } : undefined);
        if (r === 0) {
          const m = cursor.getMonth();
          if (m !== lastMonth) {
            labels.push({ col, label: format(cursor, 'MMM') });
            lastMonth = m;
          }
        }
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
      }
      cols.push(column);
      col++;
    }
    return { columns: cols, monthLabels: labels };
  }, [days]);

  const colW = CELL + GAP;

  return (
    <View>
      <View style={[styles.monthRow, { marginLeft: 0 }]}>
        {monthLabels.map((m, i) => (
          <Text key={i} style={[styles.monthLabel, { left: m.col * colW }]}>
            {m.label}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {columns.map((column, ci) => (
          <View key={ci} style={styles.column}>
            {column.map((d, ri) => (
              <HeatCell key={ri} day={d} accent={accent} />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Less</Text>
        {LEVEL_COLORS.map((c, i) => (
          <View key={i} style={[styles.legendCell, { backgroundColor: c }, i === 0 && styles.cellEmpty]} />
        ))}
        <Text style={styles.legendText}>More</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: { height: 16, position: 'relative' },
  monthLabel: { position: 'absolute', color: colors.textDim, fontSize: 10, fontFamily },
  grid: { flexDirection: 'row' },
  column: { flexDirection: 'column' },
  cell: {
    width: CELL,
    height: CELL,
    margin: GAP / 2,
    borderRadius: 3,
    borderColor: 'transparent',
  },
  cellEmpty: { borderWidth: 1, borderColor: colors.border },
  tooltip: {
    position: 'absolute',
    bottom: CELL + 4,
    left: -60,
    width: 150,
    backgroundColor: '#000',
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 6,
    zIndex: 50,
    alignItems: 'center',
  },
  tooltipText: { color: '#fff', fontSize: 11, textAlign: 'center', fontFamily },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: spacing(1), justifyContent: 'flex-end' },
  legendText: { color: colors.textDim, fontSize: 10, marginHorizontal: 4, fontFamily },
  legendCell: { width: CELL, height: CELL, borderRadius: 3 },
});
