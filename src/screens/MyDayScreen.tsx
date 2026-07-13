import React, { useMemo } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { useUIPrefs } from '../store/useUIPrefs';
import { TaskListView, ListItem } from '../components/TaskListView';
import { Tooltip } from '../components/Tooltip';
import { todayKey } from '../lib/dates';
import { occursOn, isRecurring, occurrenceStatus, currentOccurrenceKey } from '../lib/recurrence';
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
    // Tasks to focus on today: those whose target date is today, plus recurring
    // tasks that fall due today. Recurrence has no per-occurrence target date, so
    // it keeps driving My Day for repeats (daily/weekly/monthly + custom rules).
    // Each row's dateKey stays anchored to the task's own occurrence so its
    // completion state stays consistent with every other screen.
    const todayItems = tasks
      .filter((t) => t.targetDate === today || (isRecurring(t) && occursOn(t, today)))
      .sort((a, b) => {
        const ao = a.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return (a.time ?? '99:99').localeCompare(b.time ?? '99:99');
      })
      .map<ListItem>((task) => ({ task, dateKey: currentOccurrenceKey(task, today) }));

    // Overdue tasks: non-recurring tasks whose target date has already passed and
    // that are still pending. Recurring tasks are excluded — they roll forward and
    // resurface under "today" on their next due date instead of lingering here.
    // The 🎯 target-date badge (always rendered by the row) surfaces the missed
    // deadline, so no extra date badge is needed here.
    const overdueItems = tasks
      .filter((t) => !isRecurring(t) && !!t.targetDate && t.targetDate < today)
      .map((task) => ({ task, occ: currentOccurrenceKey(task, today) }))
      .filter(({ task, occ }) => occurrenceStatus(task, occ) === 'pending')
      .sort((a, b) => (a.task.targetDate ?? '').localeCompare(b.task.targetDate ?? ''))
      .map<ListItem>(({ task, occ }) => ({
        task,
        dateKey: occ,
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
