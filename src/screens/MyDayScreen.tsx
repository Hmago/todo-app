import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { TaskListView, ListItem } from '../components/TaskListView';
import { todayKey } from '../lib/dates';
import { occursOn } from '../lib/recurrence';
import { quickAddToTask } from '../lib/quickAdd';
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
  const today = todayKey();

  const items: ListItem[] = useMemo(
    () =>
      tasks
        .filter((t) => occursOn(t, today))
        .sort((a, b) => {
          const ao = a.order ?? Number.MAX_SAFE_INTEGER;
          const bo = b.order ?? Number.MAX_SAFE_INTEGER;
          if (ao !== bo) return ao - bo;
          return (a.time ?? '99:99').localeCompare(b.time ?? '99:99');
        })
        .map((task) => ({ task, dateKey: today })),
    [tasks, today],
  );

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
    />
  );
}
