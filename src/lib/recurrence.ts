import { differenceInCalendarDays, getDate, addDays } from 'date-fns';
import { Task, RecurrenceRule } from '../types';
import { fromKey, toKey } from './dates';

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

/** The first occurrence date key strictly after `afterKey`, or null if non-recurring. */
export function nextOccurrence(task: Task, afterKey: string): string | null {
  if (task.recurrence === 'none') return null;
  const cursor = fromKey(afterKey);
  for (let i = 0; i < 800; i++) {
    cursor.setDate(cursor.getDate() + 1);
    const key = toKey(cursor);
    if (occursOn(task, key)) return key;
  }
  return null;
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
  if (rule) {
    switch (rule.kind) {
      case 'everyNDays':
        return rule.n === 1 ? 'Daily' : `Every ${rule.n} days`;
      case 'weekdays':
        if (rule.days.length === 0) return 'Custom';
        return [...rule.days].sort((a, b) => a - b).map((d) => WEEKDAY_ABBR[d]).join(', ');
      case 'lastWeekdayOfMonth':
        return `Last ${WEEKDAY_ABBR[rule.weekday]} monthly`;
      default:
        return 'Custom';
    }
  }
  return task.recurrence === 'none' ? '' : RECURRENCE_LABEL[task.recurrence];
}

export { WEEKDAY_ABBR };
