import { differenceInCalendarDays, getDate, addDays } from 'date-fns';
import { Task, RecurrenceRule } from '../types';
import { fromKey, toKey, todayKey, prettyDate } from './dates';

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Is `date` the last given weekday (0=Sun..6=Sat) of its month? */
function isLastWeekdayOfMonth(date: Date, weekday: number): boolean {
  if (date.getDay() !== weekday) return false;
  return addDays(date, 7).getMonth() !== date.getMonth();
}

function occursByRule(task: Task, target: Date, rule: RecurrenceRule): boolean {
  const start = fromKey(task.date);
  const diff = differenceInCalendarDays(target, start);
  if (diff < 0) return false;
  switch (rule.kind) {
    case 'everyNDays':
      return rule.n > 0 && diff % rule.n === 0;
    case 'weekdays':
      return rule.days.includes(target.getDay());
    case 'lastWeekdayOfMonth':
      return isLastWeekdayOfMonth(target, rule.weekday);
    default:
      return false;
  }
}

/** Does a task occur on the given 'yyyy-MM-dd' date key? */
export function occursOn(task: Task, dateKey: string): boolean {
  if (dateKey < task.date) return false;
  // Recurrence end date (Outlook-style "ends by"): no occurrences past it.
  if (task.recurrenceEnd && dateKey > task.recurrenceEnd) return false;

  const start = fromKey(task.date);
  const target = fromKey(dateKey);

  if (task.recurrenceRule) return occursByRule(task, target, task.recurrenceRule);

  const diff = differenceInCalendarDays(target, start);

  switch (task.recurrence) {
    case 'none':
      return dateKey === task.date;
    case 'daily':
      return diff >= 0;
    case 'weekly':
      return diff >= 0 && diff % 7 === 0;
    case 'monthly':
      return diff >= 0 && getDate(target) === getDate(start);
    default:
      return false;
  }
}

export function isOccurrenceDone(task: Task, dateKey: string): boolean {
  return task.completedDates.includes(dateKey);
}

export function isOccurrenceSkipped(task: Task, dateKey: string): boolean {
  return !!task.skippedDates?.includes(dateKey);
}

export type OccurrenceStatus = 'pending' | 'completed' | 'skipped';

/** Tri-state status for a task on a given date. Completed wins over skipped if
 * both are somehow present (defensive — they're kept mutually exclusive by the
 * store actions). */
export function occurrenceStatus(task: Task, dateKey: string): OccurrenceStatus {
  if (task.completedDates.includes(dateKey)) return 'completed';
  if (task.skippedDates?.includes(dateKey)) return 'skipped';
  return 'pending';
}

/** True when a task repeats (simple recurrence or a custom rule). */
export function isRecurring(task: Task): boolean {
  return task.recurrence !== 'none' || !!task.recurrenceRule;
}

/** The first occurrence date key strictly after `afterKey`, or null if non-recurring. */
export function nextOccurrence(task: Task, afterKey: string): string | null {
  if (!isRecurring(task)) return null;
  const cursor = fromKey(afterKey);
  for (let i = 0; i < 800; i++) {
    cursor.setDate(cursor.getDate() + 1);
    const key = toKey(cursor);
    if (occursOn(task, key)) return key;
  }
  return null;
}

/** The latest occurrence on or before `dateKey` (and on/after the task's start),
 *  or null when there is none. Bounded backward scan. */
export function lastOccurrenceOnOrBefore(task: Task, dateKey: string): string | null {
  if (dateKey < task.date) return null;
  if (!isRecurring(task)) return task.date <= dateKey ? task.date : null;
  const cursor = fromKey(dateKey);
  for (let i = 0; i < 800; i++) {
    const key = toKey(cursor);
    if (key < task.date) return null;
    if (occursOn(task, key)) return key;
    cursor.setDate(cursor.getDate() - 1);
  }
  return null;
}

/**
 * The occurrence date key a task should reference when rendered in a list
 * "today". For a one-off task this is simply its own date. For a recurring task
 * it's today when the task occurs today (so the row reflects today's
 * pending/completed state, exactly like My Day), otherwise its next upcoming
 * occurrence — so the task keeps surfacing as its live due date instead of
 * getting stuck on a long-completed anchor date. When the recurrence has ended
 * (no occurrence today or in the future) we fall back to its most recent past
 * occurrence so it shows its final state rather than the original anchor.
 *
 * Using this everywhere (instead of the raw `task.date` anchor) is what keeps
 * recurring tasks visible in Tasks / Category / Important / Planned / Search and
 * their counts after an occurrence is completed.
 */
export function currentOccurrenceKey(task: Task, today: string = todayKey()): string {
  if (!isRecurring(task)) return task.date;
  if (occursOn(task, today)) return today;
  const next = nextOccurrence(task, today);
  if (next) return next;
  return lastOccurrenceOnOrBefore(task, today) ?? task.date;
}

/** All task occurrences (task + date) within [rangeStart, rangeEnd] inclusive. */
export function expandRange(
  tasks: Task[],
  rangeStart: string,
  rangeEnd: string,
): { task: Task; dateKey: string }[] {
  const out: { task: Task; dateKey: string }[] = [];
  for (const task of tasks) {
    const start = fromKey(rangeStart);
    const end = fromKey(rangeEnd);
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
        cursor.getDate(),
      ).padStart(2, '0')}`;
      if (occursOn(task, key)) out.push({ task, dateKey: key });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return out;
}

export const RECURRENCE_LABEL: Record<Task['recurrence'], string> = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/** Short human label for any recurrence (simple or custom rule). */
export function recurrenceLabel(task: Task): string {
  const rule = task.recurrenceRule;
  let base: string;
  if (rule) {
    switch (rule.kind) {
      case 'everyNDays':
        base = rule.n === 1 ? 'Daily' : `Every ${rule.n} days`;
        break;
      case 'weekdays':
        base = rule.days.length === 0
          ? 'Custom'
          : [...rule.days].sort((a, b) => a - b).map((d) => WEEKDAY_ABBR[d]).join(', ');
        break;
      case 'lastWeekdayOfMonth':
        base = `Last ${WEEKDAY_ABBR[rule.weekday]} monthly`;
        break;
      default:
        base = 'Custom';
    }
  } else {
    base = task.recurrence === 'none' ? '' : RECURRENCE_LABEL[task.recurrence];
  }
  if (base && task.recurrenceEnd) base += ` · until ${prettyDate(task.recurrenceEnd)}`;
  return base;
}

export { WEEKDAY_ABBR };
