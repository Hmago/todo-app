import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { TaskListView, ListItem } from '../components/TaskListView';
import { todayKey, toKey } from '../lib/dates';
import { quickAddToTask } from '../lib/quickAdd';
import { addDays } from 'date-fns';

function bucket(dateKey: string): { order: number; label: string } {
  const today = todayKey();
  const tomorrow = toKey(addDays(new Date(), 1));
  const weekEnd = toKey(addDays(new Date(), 7));
  if (dateKey < today) return { order: 0, label: 'Overdue' };
  if (dateKey === today) return { order: 1, label: 'Today' };
  if (dateKey === tomorrow) return { order: 2, label: 'Tomorrow' };
  if (dateKey <= weekEnd) return { order: 3, label: 'This week' };
  return { order: 4, label: 'Later' };
}

export function PlannedScreen() {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const categories = useStore((s) => s.categories);
  const openNew = useUI((s) => s.openNew);
  const today = todayKey();

  const items: ListItem[] = useMemo(() => {
    return tasks
      .map((task) => ({ task, b: bucket(task.date) }))
      .sort((a, b) => a.b.order - b.b.order || a.task.date.localeCompare(b.task.date))
      .map(({ task, b }) => ({ task, dateKey: task.date, showDate: true, groupLabel: b.label }));
  }, [tasks]);

  return (
    <TaskListView
      themeKey="planned"
      icon="🗓️"
      title="Planned"
      items={items}
      emptyIcon="🗓️"
      emptyTitle="Nothing planned"
      emptySubtitle="Tasks with a due date show up here, grouped by when they're due."
      addPlaceholder="Add a task"
      onAdd={(title) =>
        addTask(quickAddToTask(title, { date: today, type: 'task' }, categories))
      }
      onExpand={() => openNew({ date: today })}
    />
  );
}
