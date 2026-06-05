import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { TaskListView, ListItem } from '../components/TaskListView';
import { todayKey } from '../lib/dates';
import { quickAddToTask } from '../lib/quickAdd';

export function ImportantScreen() {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const categories = useStore((s) => s.categories);
  const setTaskOrder = useStore((s) => s.setTaskOrder);
  const openNew = useUI((s) => s.openNew);
  const today = todayKey();

  const items: ListItem[] = useMemo(
    () =>
      tasks
        .filter((t) => t.important)
        .sort((a, b) => {
          const ao = a.order ?? Number.MAX_SAFE_INTEGER;
          const bo = b.order ?? Number.MAX_SAFE_INTEGER;
          if (ao !== bo) return ao - bo;
          return a.date.localeCompare(b.date);
        })
        .map((task) => ({ task, dateKey: task.date, showDate: true })),
    [tasks],
  );

  return (
    <TaskListView
      themeKey="important"
      icon="⭐"
      title="Important"
      items={items}
      emptyIcon="⭐"
      emptyTitle="Try starring some tasks"
      emptySubtitle="Tap the star on any task to see it here."
      addPlaceholder="Add an important task"
      onAdd={(title) =>
        addTask(quickAddToTask(title, { date: today, type: 'task', important: true }, categories))
      }
      onExpand={() => openNew({ date: today, important: true })}
      onReorderMove={(ids) => setTaskOrder(ids)}
    />
  );
}
