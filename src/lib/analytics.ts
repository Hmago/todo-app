import { Task, StudySession, LearningGoal } from '../types';
import { occursOn, isOccurrenceDone, expandRange } from './recurrence';
import { shiftDateKey, toKey, fromKey, todayKey } from './dates';
import { startOfWeek, format, differenceInCalendarDays } from 'date-fns';

export interface DayStat {
  key: string;
  scheduled: number;
  completed: number;
  focusMin: number;
}

export interface WeekStat {
  weekStart: string;
  label: string;
  scheduled: number;
  completed: number;
  rate: number;
  focusMin: number;
}

/** Build an inclusive day-by-day series between two date keys (yyyy-MM-dd). */
export function dailySeries(
  tasks: Task[],
  sessions: StudySession[],
  fromKeyStr: string,
  toKeyStr: string,
): DayStat[] {
  const focusByDay = new Map<string, number>();
  for (const s of sessions) focusByDay.set(s.date, (focusByDay.get(s.date) ?? 0) + s.minutes);

  const out: DayStat[] = [];
  let cur = fromKeyStr;
  let guard = 0;
  while (cur <= toKeyStr && guard < 4000) {
    let scheduled = 0;
    let completed = 0;
    for (const t of tasks) {
      if (occursOn(t, cur)) {
        scheduled++;
        if (isOccurrenceDone(t, cur)) completed++;
      }
    }
    out.push({ key: cur, scheduled, completed, focusMin: focusByDay.get(cur) ?? 0 });
    cur = shiftDateKey(cur, 1);
    guard++;
  }
  return out;
}

/** Group a daily series into weeks (Sun-start). */
export function weeklyFromDaily(days: DayStat[]): WeekStat[] {
  const map = new Map<string, WeekStat>();
  for (const d of days) {
    const ws = toKey(startOfWeek(fromKey(d.key), { weekStartsOn: 0 }));
    let w = map.get(ws);
    if (!w) {
      w = { weekStart: ws, label: format(fromKey(ws), 'MMM d'), scheduled: 0, completed: 0, rate: 0, focusMin: 0 };
      map.set(ws, w);
    }
    w.scheduled += d.scheduled;
    w.completed += d.completed;
    w.focusMin += d.focusMin;
  }
  const weeks = Array.from(map.values()).sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
  for (const w of weeks) w.rate = w.scheduled ? w.completed / w.scheduled : 0;
  return weeks;
}

/** Activity level for heatmap colouring: completed occurrences plus a focus bonus. */
export function activityLevel(d: DayStat): number {
  const raw = d.completed + (d.focusMin >= 1 ? 1 : 0);
  if (raw <= 0) return 0;
  if (raw === 1) return 1;
  if (raw <= 3) return 2;
  if (raw <= 5) return 3;
  return 4;
}

/** Current consecutive-day streak of fully-completed scheduled days ending today. */
export function completionStreak(days: DayStat[], today = todayKey()): number {
  const byKey = new Map(days.map((d) => [d.key, d]));
  let streak = 0;
  let cur = today;
  for (let i = 0; i < days.length + 1; i++) {
    const d = byKey.get(cur);
    if (!d) break;
    if (d.scheduled > 0 && d.completed >= d.scheduled) {
      streak++;
    } else if (i === 0 && d.scheduled === 0) {
      // today with nothing scheduled doesn't break the streak
    } else {
      break;
    }
    cur = shiftDateKey(cur, -1);
  }
  return streak;
}

/** Longest run of fully-completed scheduled days within the series. */
export function bestStreak(days: DayStat[]): number {
  let best = 0;
  let run = 0;
  for (const d of days) {
    if (d.scheduled > 0 && d.completed >= d.scheduled) {
      run++;
      if (run > best) best = run;
    } else if (d.scheduled > 0) {
      run = 0;
    }
  }
  return best;
}

export interface SeriesTotals {
  scheduled: number;
  completed: number;
  rate: number;
  focusMin: number;
  activeDays: number;
}

export function seriesTotals(days: DayStat[]): SeriesTotals {
  let scheduled = 0;
  let completed = 0;
  let focusMin = 0;
  let activeDays = 0;
  for (const d of days) {
    scheduled += d.scheduled;
    completed += d.completed;
    focusMin += d.focusMin;
    if (d.completed > 0 || d.focusMin > 0) activeDays++;
  }
  return { scheduled, completed, rate: scheduled ? completed / scheduled : 0, focusMin, activeDays };
}

// ---------------------------------------------------------------------------
// Period-over-period helpers
// ---------------------------------------------------------------------------

export interface PeriodRange {
  /** Inclusive start, 'yyyy-MM-dd' */
  from: string;
  /** Inclusive end, 'yyyy-MM-dd' */
  to: string;
  /** Day count (inclusive). */
  days: number;
}

/** Build the period immediately preceding `[from, to]` with the same length. */
export function previousPeriod(from: string, to: string): PeriodRange {
  const days = Math.max(1, differenceInCalendarDays(fromKey(to), fromKey(from)) + 1);
  const prevTo = shiftDateKey(from, -1);
  const prevFrom = shiftDateKey(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo, days };
}

export type DeltaKind = 'count' | 'rate' | 'duration';

export interface Delta {
  kind: DeltaKind;
  current: number;
  previous: number;
  /** Absolute change (current - previous). */
  delta: number;
  /** Percentage change for counts/durations. null when previous is 0 or kind is 'rate'. */
  pct: number | null;
}

/** Compute the delta between current and previous values. */
export function computeDelta(current: number, previous: number, kind: DeltaKind = 'count'): Delta {
  const d = current - previous;
  if (kind === 'rate') return { kind, current, previous, delta: d, pct: null };
  const pct = previous === 0 ? null : d / previous;
  return { kind, current, previous, delta: d, pct };
}

/** Short label, e.g. "+12%", "+5pp", "+30m", "—" or "+new". */
export function formatDelta(d: Delta): string {
  if (d.kind === 'rate') {
    const pp = Math.round(d.delta * 100);
    if (pp === 0) return '±0pp';
    return `${pp > 0 ? '+' : ''}${pp}pp`;
  }
  if (d.previous === 0 && d.current === 0) return '—';
  if (d.pct == null) return d.current > 0 ? '+new' : '—';
  const pct = Math.round(d.pct * 100);
  if (pct === 0) return '±0%';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

// ---------------------------------------------------------------------------
// Tag breakdown
// ---------------------------------------------------------------------------

export interface TagStat {
  tag: string;
  total: number;
  done: number;
  rate: number;
}

/**
 * Aggregate occurrences in `[fromKey, toKey]` by tag. A task with multiple tags
 * contributes to each (totals across tags may therefore exceed the unique
 * occurrence count — like GitHub language stats).
 */
export function tagBreakdown(
  tasks: Task[],
  fromKeyStr: string,
  toKeyStr: string,
  topN = 12,
): TagStat[] {
  const map = new Map<string, { total: number; done: number }>();
  const occs = expandRange(tasks, fromKeyStr, toKeyStr);
  for (const { task, dateKey } of occs) {
    const tags = task.tags ?? [];
    if (tags.length === 0) continue;
    const done = isOccurrenceDone(task, dateKey);
    for (const tag of tags) {
      let bucket = map.get(tag);
      if (!bucket) {
        bucket = { total: 0, done: 0 };
        map.set(tag, bucket);
      }
      bucket.total++;
      if (done) bucket.done++;
    }
  }
  return Array.from(map.entries())
    .map(([tag, { total, done }]) => ({
      tag,
      total,
      done,
      rate: total ? done / total : 0,
    }))
    .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag))
    .slice(0, topN);
}

// ---------------------------------------------------------------------------
// Time-of-day histogram
// ---------------------------------------------------------------------------

export interface HourBucket {
  hour: number;
  completed: number;
  focusMin: number;
}

export interface HourHistogram {
  hours: HourBucket[];
  /** Completions in range that had a recorded clock time. */
  tracked: number;
  /** Completions in range without a recorded time (older data). */
  untracked: number;
  /** Total focus minutes across all hours in the range. */
  focusMin: number;
  /** Hour 0..23 with the most completions, or null when none. */
  peakHour: number | null;
  /** Hour 0..23 with the most focus minutes, or null when none. */
  peakFocusHour: number | null;
}

/**
 * Bucket completed-occurrence times and study-session minutes into 24 hourly
 * bins for the inclusive range `[fromKeyStr, toKeyStr]`.
 */
export function hourlyHistogram(
  tasks: Task[],
  sessions: StudySession[],
  fromKeyStr: string,
  toKeyStr: string,
): HourHistogram {
  const hours: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    completed: 0,
    focusMin: 0,
  }));
  let tracked = 0;
  let untracked = 0;
  for (const t of tasks) {
    if (!t.completedDates?.length) continue;
    for (const dk of t.completedDates) {
      if (dk < fromKeyStr || dk > toKeyStr) continue;
      const hhmm = t.completedTimes?.[dk];
      if (!hhmm) {
        untracked++;
        continue;
      }
      const h = parseInt(hhmm.slice(0, 2), 10);
      if (!Number.isFinite(h) || h < 0 || h > 23) {
        untracked++;
        continue;
      }
      hours[h].completed++;
      tracked++;
    }
  }
  let focusMin = 0;
  for (const s of sessions) {
    if (s.date < fromKeyStr || s.date > toKeyStr) continue;
    const d = new Date(s.createdAt);
    const h = d.getHours();
    if (Number.isNaN(d.getTime()) || !Number.isFinite(h) || h < 0 || h > 23) continue;
    hours[h].focusMin += s.minutes;
    focusMin += s.minutes;
  }
  let peakHour: number | null = null;
  let peakVal = 0;
  let peakFocusHour: number | null = null;
  let peakFocusVal = 0;
  for (const b of hours) {
    if (b.completed > peakVal) {
      peakVal = b.completed;
      peakHour = b.hour;
    }
    if (b.focusMin > peakFocusVal) {
      peakFocusVal = b.focusMin;
      peakFocusHour = b.hour;
    }
  }
  return { hours, tracked, untracked, focusMin, peakHour, peakFocusHour };
}

// ---------------------------------------------------------------------------
// Goal progress
// ---------------------------------------------------------------------------

export type GoalStatus =
  | 'complete'
  | 'ahead'
  | 'on-track'
  | 'behind'
  | 'overdue'
  | 'no-target';

export interface GoalProgress {
  done: number;
  total: number;
  /** Fraction of milestones completed, 0..1. */
  ratio: number;
  /** Elapsed fraction of the goal's time budget, 0..1. null when no target. */
  expected: number | null;
  /** differenceInCalendarDays(target, today); null when no target. Negative = past. */
  daysLeft: number | null;
  /** Total span between createdAt and targetDate, in days; null when no target. */
  totalSpanDays: number | null;
  status: GoalStatus;
}

/** ±10 percentage points of expected progress is considered "on track". */
export const GOAL_ON_TRACK_THRESHOLD = 0.1;

/** Derive at-a-glance progress signals for a single goal. */
export function goalProgress(goal: LearningGoal, today = todayKey()): GoalProgress {
  const total = goal.milestones.length;
  const done = goal.milestones.filter((m) => m.done).length;
  const ratio = total > 0 ? done / total : 0;

  if (!goal.targetDate) {
    return {
      done,
      total,
      ratio,
      expected: null,
      daysLeft: null,
      totalSpanDays: null,
      status: total > 0 && ratio >= 1 ? 'complete' : 'no-target',
    };
  }

  const target = fromKey(goal.targetDate);
  const createdRaw = new Date(goal.createdAt);
  const created = Number.isNaN(createdRaw.getTime()) ? fromKey(today) : createdRaw;
  const todayDate = fromKey(today);

  const totalSpanDaysRaw = differenceInCalendarDays(target, created);
  const totalSpanDays = Math.max(0, totalSpanDaysRaw);
  const elapsedDays = differenceInCalendarDays(todayDate, created);
  const expected =
    totalSpanDays <= 0 ? 1 : Math.max(0, Math.min(1, elapsedDays / totalSpanDays));
  const daysLeft = differenceInCalendarDays(target, todayDate);

  let status: GoalStatus;
  if (total > 0 && ratio >= 1) status = 'complete';
  else if (daysLeft < 0) status = 'overdue';
  else if (Math.abs(ratio - expected) <= GOAL_ON_TRACK_THRESHOLD) status = 'on-track';
  else if (ratio > expected) status = 'ahead';
  else status = 'behind';

  return { done, total, ratio, expected, daysLeft, totalSpanDays, status };
}

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  complete: 'Complete',
  ahead: 'Ahead',
  'on-track': 'On track',
  behind: 'Behind',
  overdue: 'Overdue',
  'no-target': 'No target',
};
