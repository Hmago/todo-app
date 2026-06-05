import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useUI } from '../store/useUI';
import { TaskListView, ListItem } from '../components/TaskListView';
import { todayKey } from '../lib/dates';
import { quickAddToTask } from '../lib/quickAdd';

function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt * 255)));
  g = Math.max(0, Math.min(255, Math.round(g + amt * 255)));
  b = Math.max(0, Math.min(255, Math.round(b + amt * 255)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function AllTasksScreen({ onBack }: { onBack?: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const categories = useStore((s) => s.categories);
  const setTaskOrder = useStore((s) => s.setTaskOrder);
  const openNew = useUI((s) => s.openNew);
  const today = todayKey();

  const items: ListItem[] = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => {
          const ao = a.order ?? Number.MAX_SAFE_INTEGER;
          const bo = b.order ?? Number.MAX_SAFE_INTEGER;
          if (ao !== bo) return ao - bo;
          return b.createdAt.localeCompare(a.createdAt);
        })
        .map((task) => ({ task, dateKey: task.date, showDate: true })),
    [tasks],
  );

  return (
    <TaskListView
      themeKey="tasks"
      icon="🏠"
      title="Tasks"
      items={items}
      emptyIcon="📝"
      emptyTitle="No tasks yet"
      emptySubtitle="Everything you add lives here."
      addPlaceholder="Add a task"
      onAdd={(title) =>
        addTask(quickAddToTask(title, { date: today, type: 'task' }, categories))
      }
      onExpand={() => openNew({ date: today })}
      onBack={onBack}
      onReorderMove={(ids) => setTaskOrder(ids)}
    />
  );
}

export function CategoryScreen({ categoryId, onBack }: { categoryId: string; onBack?: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const category = useStore((s) => s.categories.find((c) => c.id === categoryId));
  const categories = useStore((s) => s.categories);
  const addTask = useStore((s) => s.addTask);
  const setTaskOrder = useStore((s) => s.setTaskOrder);
  const openNew = useUI((s) => s.openNew);
  const today = todayKey();

  const items: ListItem[] = useMemo(
    () =>
      tasks
        .filter((t) => t.categoryId === categoryId)
        .sort((a, b) => {
          const ao = a.order ?? Number.MAX_SAFE_INTEGER;
          const bo = b.order ?? Number.MAX_SAFE_INTEGER;
          if (ao !== bo) return ao - bo;
          return a.date.localeCompare(b.date);
        })
        .map((task) => ({ task, dateKey: task.date, showDate: true })),
    [tasks, categoryId],
  );

  const accent = category?.color ?? '#2b6a45';
  const gradient: [string, string] = [shade(accent, -0.28), accent];

  return (
    <TaskListView
      themeKey="tasks"
      accent={accent}
      gradient={gradient}
      icon="📋"
      title={category?.name ?? 'List'}
      items={items}
      emptyIcon="📋"
      emptyTitle="This list is empty"
      emptySubtitle="Add a task to this category."
      addPlaceholder="Add a task"
      onAdd={(title) =>
        addTask(quickAddToTask(title, { date: today, type: 'task', categoryId }, categories))
      }
      onExpand={() => openNew({ date: today, categoryId })}
      onBack={onBack}
      onReorderMove={(ids) => setTaskOrder(ids)}
    />
  );
}
