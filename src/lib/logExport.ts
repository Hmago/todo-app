import { format, parseISO, isValid, eachDayOfInterval } from 'date-fns';
import { Task, Category, LogEntry } from '../types';
import { useStore } from '../store/useStore';
import { fromKey, toKey, pretty12h, todayKey, shiftDateKey } from './dates';
import { occursOn, occurrenceStatus, isRecurring, OccurrenceStatus } from './recurrence';
import { downloadText } from './dataio';

const RULE = '='.repeat(52);
const DIVIDER = '─'.repeat(52);

export interface DailyLogOptions {
  /** Inclusive range start, 'yyyy-MM-dd'. */
  from: string;
  /** Inclusive range end, 'yyyy-MM-dd'. */
  to: string;
  logs: LogEntry[];
  tasks: Task[];
  categories: Category[];
  /** When true, days with no activity are still printed (as "no activity"). */
  includeEmptyDays?: boolean;
}

export interface DailyLogReport {
  text: string;
  /** Number of days in range that had at least one log or completed task. */
  activeDays: number;
  logCount: number;
  taskCount: number;
  /** Recurring occurrences in range that were due in the past but not done. */
  missedCount: number;
  /** Recurring occurrences in range the user explicitly skipped. */
  skippedCount: number;
}

export interface DailyLogSummary {
  activeDays: number;
  logCount: number;
  taskCount: number;
  missedCount: number;
  skippedCount: number;
}

/** One-word status for a recurring occurrence on `day` relative to `today`. */
function recurStatusWord(status: OccurrenceStatus, day: string, today: string): string {
  if (status === 'completed') return 'done';
  if (status === 'skipped') return 'skipped';
  if (day < today) return 'missed';
  if (day === today) return 'due';
  return 'scheduled';
}

/** Long, human day heading e.g. "Monday, June 1, 2026". */
function dayHeading(key: string): string {
  return format(fromKey(key), 'EEEE, MMMM d, yyyy');
}

/** 12-hour time from an ISO timestamp, e.g. "9:14 AM"; '' when unparseable. */
function isoTime(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'h:mm a') : '';
}

/** Normalize a range so start <= end regardless of input order. */
function orderRange(from: string, to: string): { start: string; end: string } {
  return from <= to ? { start: from, end: to } : { start: to, end: from };
}

/**
 * Count logs and completed tasks within a date range (no string building).
 * Used to drive the live "what will be exported" preview in Settings.
 */
export function summarizeDailyLogs(opts: {
  from: string;
  to: string;
  logs: LogEntry[];
  tasks: Task[];
}): DailyLogSummary {
  const { start, end } = orderRange(opts.from, opts.to);
  const today = todayKey();
  const active = new Set<string>();
  let logCount = 0;
  let taskCount = 0;
  let missedCount = 0;
  let skippedCount = 0;
  for (const l of opts.logs) {
    if (l.date >= start && l.date <= end) {
      logCount++;
      active.add(l.date);
    }
  }
  for (const t of opts.tasks) {
    for (const d of t.completedDates) {
      if (d >= start && d <= end) {
        taskCount++;
        active.add(d);
      }
    }
  }
  // Walk the range once for recurring occurrences that fell due but weren't
  // completed (missed / skipped). Completed ones are already in `taskCount`.
  const recurring = opts.tasks.filter(isRecurring);
  if (recurring.length) {
    let cur = start;
    let guard = 0;
    while (cur <= end && guard < 4000) {
      for (const t of recurring) {
        if (!occursOn(t, cur)) continue;
        active.add(cur);
        const st = occurrenceStatus(t, cur);
        if (st === 'skipped') skippedCount++;
        else if (st === 'pending' && cur < today) missedCount++;
      }
      cur = shiftDateKey(cur, 1);
      guard++;
    }
  }
  return { activeDays: active.size, logCount, taskCount, missedCount, skippedCount };
}

/**
 * Build a readable, day-segregated plain-text report of daily logs, completed
 * one-off tasks, and recurring-task adherence within an inclusive date range.
 * Mirrors the Daily Log screen: manual entries, completed one-offs, and a
 * per-day "Recurring" block showing done / missed / skipped / due occurrences.
 */
export function buildDailyLogReport(opts: DailyLogOptions): DailyLogReport {
  const { logs, tasks, categories, includeEmptyDays = false } = opts;
  const { start, end } = orderRange(opts.from, opts.to);
  const today = todayKey();
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name;
  const recurringTasks = tasks.filter(isRecurring);

  // Group manual log entries by their day.
  const logsByDay = new Map<string, LogEntry[]>();
  for (const l of logs) {
    if (l.date < start || l.date > end) continue;
    const arr = logsByDay.get(l.date);
    if (arr) arr.push(l);
    else logsByDay.set(l.date, [l]);
  }

  // Group completed one-off (non-recurring) tasks by completion day. Recurring
  // completions are surfaced in the per-day "Recurring" block instead, next to
  // their missed / skipped siblings.
  const tasksByDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (isRecurring(t)) continue;
    for (const d of t.completedDates) {
      if (d < start || d > end) continue;
      const arr = tasksByDay.get(d);
      if (arr) arr.push(t);
      else tasksByDay.set(d, [t]);
    }
  }

  const days = eachDayOfInterval({ start: fromKey(start), end: fromKey(end) }).map(toKey);
  const sections: string[] = [];

  for (const day of days) {
    const dayLogs = (logsByDay.get(day) ?? [])
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const timeOf = (t: Task) => t.completedTimes?.[day] ?? '';
    const dayTasks = (tasksByDay.get(day) ?? []).slice().sort((a, b) => {
      const ta = timeOf(a);
      const tb = timeOf(b);
      if (ta && tb && ta !== tb) return ta.localeCompare(tb);
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      return a.title.localeCompare(b.title);
    });

    // Recurring occurrences scheduled on this day, with status. Done first, then
    // pending (missed/due), then skipped.
    const statusRank = (s: OccurrenceStatus): number =>
      s === 'completed' ? 0 : s === 'pending' ? 1 : 2;
    const dayRecurring = recurringTasks
      .filter((t) => occursOn(t, day))
      .map((task) => ({ task, status: occurrenceStatus(task, day) }))
      .sort(
        (a, b) => statusRank(a.status) - statusRank(b.status) || a.task.title.localeCompare(b.task.title),
      );

    const hasActivity = dayLogs.length > 0 || dayTasks.length > 0 || dayRecurring.length > 0;
    if (!hasActivity && !includeEmptyDays) continue;

    const lines: string[] = [DIVIDER, `  ${dayHeading(day)}`, DIVIDER];

    if (!hasActivity) {
      lines.push('  (no activity)');
    } else {
      if (dayLogs.length) {
        lines.push('', `  Logged (${dayLogs.length})`);
        for (const l of dayLogs) {
          const time = isoTime(l.createdAt);
          lines.push(`    • ${time ? `[${time}] ` : ''}${l.text}`);
        }
      }
      if (dayTasks.length) {
        lines.push('', `  Completed tasks (${dayTasks.length})`);
        for (const t of dayTasks) {
          const meta: string[] = [];
          const cat = catName(t.categoryId);
          if (cat) meta.push(cat);
          if (t.priority && t.priority !== 'medium') meta.push(`${t.priority} priority`);
          const time = pretty12h(timeOf(t));
          const suffix = meta.length ? `  (${meta.join(' · ')})` : '';
          lines.push(`    • ${time ? `[${time}] ` : ''}${t.title}${suffix}`);
        }
      }
      if (dayRecurring.length) {
        lines.push('', `  Recurring (${dayRecurring.length})`);
        for (const { task: t, status } of dayRecurring) {
          const word = recurStatusWord(status, day, today);
          const cat = catName(t.categoryId);
          const time = status === 'completed' ? pretty12h(t.completedTimes?.[day] ?? '') : '';
          const suffix = cat ? `  (${cat})` : '';
          lines.push(`    • ${time ? `[${time}] ` : ''}${t.title} — ${word}${suffix}`);
        }
      }
    }

    sections.push(lines.join('\n'));
  }

  // Counts come from the shared summarizer so the header always matches the
  // Settings preview exactly.
  const summary = summarizeDailyLogs({ from: start, to: end, logs, tasks });

  const now = new Date();
  const habitBits: string[] = [];
  if (summary.missedCount > 0) habitBits.push(`${summary.missedCount} missed`);
  if (summary.skippedCount > 0) habitBits.push(`${summary.skippedCount} skipped`);
  const header = [
    RULE,
    '  DAILY LOG  ·  To Do',
    RULE,
    '',
    `  Range:      ${dayHeading(start)}`,
    `              → ${dayHeading(end)}`,
    `  Generated:  ${format(now, 'MMMM d, yyyy')} at ${format(now, 'h:mm a')}`,
    `  Summary:    ${summary.activeDays} active day${summary.activeDays === 1 ? '' : 's'} · ` +
      `${summary.logCount} log${summary.logCount === 1 ? '' : 's'} · ` +
      `${summary.taskCount} completed task${summary.taskCount === 1 ? '' : 's'}` +
      (habitBits.length ? ` · ${habitBits.join(' · ')} (recurring)` : ''),
    '',
  ];

  const body = sections.length ? sections.join('\n\n\n') : '  No activity in this range.';
  const text = `${header.join('\n')}\n${body}\n`;

  return {
    text,
    activeDays: summary.activeDays,
    logCount: summary.logCount,
    taskCount: summary.taskCount,
    missedCount: summary.missedCount,
    skippedCount: summary.skippedCount,
  };
}

/**
 * Build the report from the live store and trigger a download (web) or share
 * sheet (native) as a `.txt` file. Returns the report so the caller can show a
 * summary message.
 */
export function exportDailyLogs(from: string, to: string, includeEmptyDays = false): DailyLogReport {
  const s = useStore.getState();
  const report = buildDailyLogReport({
    from,
    to,
    logs: s.logs,
    tasks: s.tasks,
    categories: s.categories,
    includeEmptyDays,
  });
  const { start, end } = orderRange(from, to);
  downloadText(`todo-daily-logs-${start}_to_${end}.txt`, report.text, 'text/plain');
  return report;
}
