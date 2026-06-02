import { Task, StudySession } from '../types';
import { occursOn, isOccurrenceDone } from './recurrence';
import { shiftDateKey, toKey, fromKey, todayKey } from './dates';
import { startOfWeek, format } from 'date-fns';

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
