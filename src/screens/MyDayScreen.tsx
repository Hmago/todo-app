import React, { useMemo } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { useUIPrefs } from '../store/useUIPrefs';
import { TaskListView, ListItem } from '../components/TaskListView';
import { Tooltip } from '../components/Tooltip';
import { todayKey } from '../lib/dates';
import { occursOn, occurrenceStatus, currentOccurrenceKey } from '../lib/recurrence';
import { quickAddToTask } from '../lib/quickAdd';
import { listThemes, radius, spacing, fontFamily, useTheme } from '../theme';
import { format } from 'date-fns';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function MyDayScreen() {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const categories = useStore((s) => s.categories);
  const setTaskOrder = useStore((s) => s.setTaskOrder);
  const openNew = useUI((s) => s.openNew);
  const hideOverdue = useUIPrefs((s) => s.hideOverdueInMyDay);
  const toggleHideOverdue = useUIPrefs((s) => s.toggleHideOverdueInMyDay);
  const colors = useTheme();
  const today = todayKey();
  const accent = listThemes.myday.accent;

  const { items, overdueCount } = useMemo(() => {
    // Today's scheduled occurrences (including recurring tasks that hit today).
    const todayItems = tasks
      .filter((t) => occursOn(t, today))
      .sort((a, b) => {
        const ao = a.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return (a.time ?? '99:99').localeCompare(b.time ?? '99:99');
      })
      .map<ListItem>((task) => ({ task, dateKey: today }));

    // Overdue pending tasks: their current occurrence falls before today and is
    // still pending. For recurring tasks the current occurrence rolls forward to
    // today / the next due date, so they never linger here on a stale anchor —
    // they show under "Today" (or on their next due day) instead.
    const overdueItems = tasks
      .map((task) => ({ task, occ: currentOccurrenceKey(task, today) }))
      .filter(({ task, occ }) => occ < today && occurrenceStatus(task, occ) === 'pending')
      .sort((a, b) => a.occ.localeCompare(b.occ))
      .map<ListItem>(({ task, occ }) => ({
        task,
        dateKey: occ,
        showDate: true,
        groupLabel: 'Overdue',
      }));

    const count = overdueItems.length;

    if (count === 0 || hideOverdue) return { items: todayItems, overdueCount: count };

    // Tag today's rows so the "Today" header renders below the overdue block.
    const labelledToday = todayItems.map((it) => ({ ...it, groupLabel: 'Today' }));
    return { items: [...overdueItems, ...labelledToday], overdueCount: count };
  }, [tasks, today, hideOverdue]);

  const styles = makeStyles(colors);

  const toolbarExtra =
    overdueCount > 0 ? (
      <Tooltip
        label={
          hideOverdue
            ? 'Show overdue tasks from past days'
            : 'Hide overdue tasks from past days'
        }
        placement="bottom"
      >
        <Pressable
          onPress={toggleHideOverdue}
          hitSlop={6}
          style={[styles.chip, { borderColor: accent }]}
          accessibilityLabel={hideOverdue ? 'Show overdue tasks' : 'Hide overdue tasks'}
        >
          <Text style={[styles.chipText, { color: accent }]}>
            {hideOverdue ? '👁  Show' : '🙈  Hide'} overdue ({overdueCount})
          </Text>
        </Pressable>
      </Tooltip>
    ) : null;

  return (
    <TaskListView
      themeKey="myday"
      icon="☀️"
      title="My Day"
      subtitle={`${greeting()} · ${format(new Date(), 'EEEE, MMMM d')}`}
      items={items}
      emptyIcon="🌤️"
      emptyTitle="Focus on your day"
      emptySubtitle="Add tasks you want to get done today."
      addPlaceholder="Add a task"
      onAdd={(title) =>
        addTask(quickAddToTask(title, { date: today, type: 'task' }, categories))
      }
      onExpand={() => openNew({ date: today })}
      onReorderMove={(ids) => setTaskOrder(ids)}
      toolbarExtra={toolbarExtra}
    />
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    chip: {
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingHorizontal: spacing(1.25),
      paddingVertical: spacing(0.5),
      backgroundColor: colors.surface,
    },
    chipText: { fontSize: 12, fontWeight: '700', fontFamily },
  });
