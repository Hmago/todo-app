import { useEffect, useRef, useState } from 'react';
import { Task } from '../types';
import { useStore } from '../store/useStore';
import { useSettings, shouldNotify } from '../store/useSettings';
import { toLocalIso, prettyReminder, todayKey, minutesOfDay } from './dates';
import { occursOn } from './recurrence';
import {
  showSystemNotification,
  canScheduleOS,
  scheduleOSNotification,
  cancelAllOSNotifications,
} from './notifications';

// Fire reminders that became due up to this long ago (avoids spamming old ones on load).
const FIRE_GRACE_MS = 10 * 60 * 1000;
const MAX_TIMEOUT = 2 ** 31 - 1;
const AGENDA_KEY = '__agenda__';

export interface DueReminder {
  key: string;
  task: Task;
  reminder: string;
}

export interface RemindersApi {
  due: DueReminder[];
  dismiss: (key: string) => void;
  complete: (d: DueReminder) => void;
  snooze: (d: DueReminder, minutes: number) => void;
}

function nextAgendaDate(hhmm: string): Date | null {
  const mins = minutesOfDay(hhmm);
  if (mins == null) return null;
  const d = new Date();
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function agendaBody(): string {
  const today = todayKey();
  const items = useStore
    .getState()
    .tasks.filter((t) => occursOn(t, today) && !t.completedDates.includes(today));
  if (items.length === 0) return 'No tasks scheduled today 🎉';
  const titles = items.slice(0, 3).map((t) => t.title).join(', ');
  return `${items.length} task${items.length === 1 ? '' : 's'} today${titles ? `: ${titles}` : ''}`;
}

export function useReminders(): RemindersApi {
  const tasks = useStore((s) => s.tasks);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const updateTask = useStore((s) => s.updateTask);
  const settings = useSettings();

  const [due, setDue] = useState<DueReminder[]>([]);
  const [tick, setTick] = useState(0);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const fired = useRef<Set<string>>(new Set());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const fire = (task: Task, reminder: string, key: string) => {
    fired.current.add(key);
    if (!shouldNotify(settingsRef.current, task, new Date())) return;
    if (!canScheduleOS()) {
      showSystemNotification(`⏰ ${task.title}`, `Reminder · ${prettyReminder(reminder)}`);
    }
    setDue((prev) => (prev.some((d) => d.key === key) ? prev : [...prev, { key, task, reminder }]));
  };

  const fireAgenda = () => {
    const s = settingsRef.current;
    if (!s.enabled || !s.agendaEnabled) return;
    if (!canScheduleOS()) showSystemNotification('☀️ Your day', agendaBody());
  };

  useEffect(() => {
    Object.values(timers.current).forEach((t) => clearTimeout(t));
    timers.current = {};

    const now = Date.now();
    const entries: { key: string; task: Task; reminder: string; ts: number }[] = [];
    for (const task of tasks) {
      for (const reminder of task.reminders ?? []) {
        const occDate = reminder.slice(0, 10);
        if (task.completedDates.includes(occDate)) continue;
        const ts = new Date(reminder).getTime();
        if (Number.isNaN(ts)) continue;
        entries.push({ key: `${task.id}@${reminder}`, task, reminder, ts });
      }
    }

    // Native: hand future reminders + agenda to the OS for background delivery.
    if (canScheduleOS()) {
      cancelAllOSNotifications().finally(() => {
        for (const e of entries) {
          if (e.ts <= now) continue;
          if (!shouldNotify(settings, e.task, new Date(e.ts))) continue;
          scheduleOSNotification(
            e.key,
            new Date(e.ts),
            `⏰ ${e.task.title}`,
            `Reminder · ${prettyReminder(e.reminder)}`,
          );
        }
        const agendaAt = nextAgendaDate(settings.agendaTime);
        if (settings.enabled && settings.agendaEnabled && agendaAt) {
          scheduleOSNotification(AGENDA_KEY, agendaAt, '☀️ Your day', agendaBody());
        }
      });
    }

    // Foreground scheduling (in-app banner + web OS notification while open).
    for (const e of entries) {
      if (fired.current.has(e.key)) continue;
      const delay = e.ts - now;
      if (delay <= 0) {
        if (-delay <= FIRE_GRACE_MS) {
          timers.current[e.key] = setTimeout(() => fire(e.task, e.reminder, e.key), 400);
        }
        continue;
      }
      timers.current[e.key] = setTimeout(
        () => fire(e.task, e.reminder, e.key),
        Math.min(delay, MAX_TIMEOUT),
      );
    }

    // Foreground daily agenda timer (web). Re-arms via tick after firing.
    if (settings.enabled && settings.agendaEnabled) {
      const agendaAt = nextAgendaDate(settings.agendaTime);
      if (agendaAt) {
        const delay = agendaAt.getTime() - now;
        if (delay > 0) {
          timers.current[AGENDA_KEY] = setTimeout(() => {
            fireAgenda();
            setTick((t) => t + 1);
          }, Math.min(delay, MAX_TIMEOUT));
        }
      }
    }

    return () => {
      Object.values(timers.current).forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, settings, tick]);

  const dismiss = (key: string) => setDue((prev) => prev.filter((d) => d.key !== key));

  const complete = (d: DueReminder) => {
    toggleComplete(d.task.id, d.reminder.slice(0, 10));
    dismiss(d.key);
  };

  const snooze = (d: DueReminder, minutes: number) => {
    const next = toLocalIso(new Date(Date.now() + minutes * 60 * 1000));
    fired.current.delete(d.key);
    const kept = (d.task.reminders ?? []).filter((r) => r !== d.reminder);
    updateTask(d.task.id, { reminders: [...kept, next] });
    dismiss(d.key);
  };

  return { due, dismiss, complete, snooze };
}
