import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { addDays } from 'date-fns';
import { radius, spacing, fontFamily, shadow, listThemes, useTheme, useThemedStyles, Palette } from '../theme';
import { useStore } from '../store/useStore';
import { ListHeader } from '../components/ListHeader';
import { AddTaskBar } from '../components/AddTaskBar';
import { EmptyState } from '../components/ui';
import { fromKey, toKey, todayKey, prettyDate } from '../lib/dates';
import { occursOn, occurrenceStatus, isRecurring, OccurrenceStatus } from '../lib/recurrence';

const ACCENT = listThemes.log.accent;

/** Status badge (label / colour / glyph) for a recurring occurrence on a day. */
function recurStatusMeta(
  colors: Palette,
  status: OccurrenceStatus,
  selected: string,
  today: string,
): { label: string; color: string; icon: string } {
  if (status === 'completed') return { label: 'Done', color: colors.success, icon: '✓' };
  if (status === 'skipped') return { label: 'Skipped', color: colors.textFaint, icon: '⤼' };
  if (selected < today) return { label: 'Missed', color: colors.danger, icon: '✕' };
  if (selected === today) return { label: 'Due', color: colors.primary, icon: '○' };
  return { label: 'Scheduled', color: colors.textDim, icon: '○' };
}

export function DailyLogScreen({ onBack }: { onBack?: () => void }) {
  const styles = useThemedStyles(makeStyles);
  const [selected, setSelected] = useState(todayKey());
  const logs = useStore((s) => s.logs);
  const tasks = useStore((s) => s.tasks);
  const addLog = useStore((s) => s.addLog);
  const deleteLog = useStore((s) => s.deleteLog);
  const colors = useTheme();
  const today = todayKey();

  const dayLogs = useMemo(
    () =>
      logs
        .filter((l) => l.date === selected)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [logs, selected],
  );

  const oneOffCompleted = useMemo(
    () => tasks.filter((t) => !isRecurring(t) && t.completedDates.includes(selected)),
    [tasks, selected],
  );

  // Recurring occurrences scheduled on the selected day, tracked with their
  // status so missed / skipped / due habits are visible — not just completed
  // ones. Missed (past pending) surface first, then due-today, completed, then
  // skipped and future scheduled.
  const recurring = useMemo(() => {
    const rank = (status: OccurrenceStatus): number => {
      if (status === 'completed') return 2;
      if (status === 'skipped') return 3;
      if (selected < today) return 0; // missed
      if (selected === today) return 1; // due today
      return 4; // scheduled (future)
    };
    return tasks
      .filter((t) => isRecurring(t) && occursOn(t, selected))
      .map((task) => ({ task, status: occurrenceStatus(task, selected) }))
      .sort((a, b) => rank(a.status) - rank(b.status) || a.task.title.localeCompare(b.task.title));
  }, [tasks, selected, today]);

  const recurDone = useMemo(
    () => recurring.filter((r) => r.status === 'completed').length,
    [recurring],
  );
  const recurMissed = useMemo(
    () => recurring.filter((r) => r.status === 'pending' && selected < today).length,
    [recurring, selected, today],
  );

  const isToday = selected === today;
  const shift = (days: number) => setSelected(toKey(addDays(fromKey(selected), days)));

  return (
    <View style={styles.screen}>
      <ListHeader
        themeKey="log"
        icon="📝"
        title="Daily Log"
        subtitle={`${dayLogs.length + oneOffCompleted.length + recurDone} done${
          recurMissed ? ` · ${recurMissed} missed` : ''
        }`}
        onBack={onBack}
      />

      <View style={styles.dateNav}>
        <Pressable onPress={() => shift(-1)} style={styles.navBtn}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Pressable onPress={() => setSelected(todayKey())} style={styles.dateLabelWrap}>
          <Text style={styles.dateLabel}>{prettyDate(selected)}</Text>
          {!isToday && <Text style={styles.todayHint}>Tap for today</Text>}
        </Pressable>
        <Pressable onPress={() => shift(1)} style={styles.navBtn}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Log</Text>
        {dayLogs.length === 0 ? (
          <EmptyState icon="✅" title="Nothing logged yet" subtitle="Add what you completed today below." />
        ) : (
          dayLogs.map((l) => (
            <View key={l.id} style={styles.item}>
              <Text style={styles.check}>✓</Text>
              <Text style={styles.itemText}>{l.text}</Text>
              <Pressable onPress={() => deleteLog(l.id)} hitSlop={8}>
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>
          ))
        )}

        {recurring.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Recurring</Text>
            {recurring.map(({ task, status }) => {
              const m = recurStatusMeta(colors, status, selected, today);
              return (
                <View key={task.id} style={styles.item}>
                  <Text style={[styles.check, { color: m.color }]}>{m.icon}</Text>
                  <Text
                    style={[styles.itemText, status === 'skipped' && styles.itemTextMuted]}
                    numberOfLines={2}
                  >
                    {task.title}
                  </Text>
                  <Text
                    style={[styles.statusTag, { color: m.color, backgroundColor: m.color + '1f' }]}
                  >
                    {m.label}
                  </Text>
                </View>
              );
            })}
          </>
        )}

        {oneOffCompleted.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Completed tasks</Text>
            {oneOffCompleted.map((t) => (
              <View key={t.id} style={styles.item}>
                <Text style={styles.check}>✓</Text>
                <Text style={styles.itemText}>{t.title}</Text>
                <Text style={styles.autoTag}>task</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: spacing(2) }} />
      </ScrollView>

      <AddTaskBar
        accent={ACCENT}
        placeholder="Add a completed item"
        onAdd={(text) => addLog(selected, text)}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1),
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navText: { color: colors.text, fontSize: 22, fontWeight: '700' },
  dateLabelWrap: { alignItems: 'center' },
  dateLabel: { color: colors.text, fontSize: 16, fontWeight: '700', fontFamily },
  todayHint: { color: ACCENT, fontSize: 11, fontWeight: '600', fontFamily, marginTop: 2 },
  content: { padding: spacing(1.5) },
  sectionLabel: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
    fontFamily,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing(1),
    marginBottom: spacing(1),
    marginLeft: spacing(0.5),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(1.5),
    marginBottom: spacing(1),
    ...shadow,
  },
  check: { color: colors.success, fontSize: 16, fontWeight: '900', marginRight: spacing(1.25) },
  itemText: { flex: 1, color: colors.text, fontSize: 15, fontFamily },
  remove: { color: colors.textFaint, fontSize: 15, fontWeight: '700', paddingLeft: spacing(1) },
  autoTag: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    fontFamily,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(1),
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusTag: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily,
    paddingHorizontal: spacing(1),
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  itemTextMuted: { color: colors.textDim, textDecorationLine: 'line-through' },
});
