import { differenceInCalendarDays } from 'date-fns';
import { LearningGoal, StudySession, Task } from '../types';
import { toKey, fromKey, todayKey, shiftDateKey } from './dates';
import { occursOn, isOccurrenceDone } from './recurrence';

/** Spaced-repetition interval ladder, in days between reviews. */
export const SR_INTERVALS = [1, 3, 7, 16, 35, 90];

/** The interval (days) for a given SR stage. */
export function srIntervalForStage(stage: number): number {
  return SR_INTERVALS[Math.min(stage, SR_INTERVALS.length - 1)];
}

/** Next review date key after reviewing at `fromKeyStr` while at `stage`. */
export function nextSrDate(stage: number, fromKeyStr: string): string {
  return shiftDateKey(fromKeyStr, srIntervalForStage(stage));
}

/** True when a goal's spaced-repetition review is due (today or earlier). */
export function isReviewDue(goal: LearningGoal, today = todayKey()): boolean {
  if (!goal.sr?.enabled || !goal.sr.nextReview) return false;
  return goal.sr.nextReview <= today;
}

/** Days until the next review (negative = overdue). null if not scheduled. */
export function daysUntilReview(goal: LearningGoal, today = todayKey()): number | null {
  if (!goal.sr?.enabled || !goal.sr.nextReview) return null;
  return differenceInCalendarDays(fromKey(goal.sr.nextReview), fromKey(today));
}

/** Days remaining until a target date (negative = past). null if no target. */
export function daysUntil(dateKey?: string, today = todayKey()): number | null {
  if (!dateKey) return null;
  return differenceInCalendarDays(fromKey(dateKey), fromKey(today));
}

/** Total logged focus minutes for a goal (optionally within last N days). */
export function minutesForGoal(sessions: StudySession[], goalId: string, sinceKey?: string): number {
  return sessions
    .filter((s) => s.goalId === goalId && (!sinceKey || s.date >= sinceKey))
    .reduce((a, s) => a + s.minutes, 0);
}

/** Number of sessions logged for a goal. */
export function sessionCountForGoal(sessions: StudySession[], goalId: string): number {
  return sessions.filter((s) => s.goalId === goalId).length;
}

/**
 * Set of day keys that count as "studied": any day with a logged study session
 * or a completed study-type task.
 */
export function studyActiveDays(sessions: StudySession[], tasks: Task[], windowDays = 400): Set<string> {
  const days = new Set<string>();
  for (const s of sessions) days.add(s.date);
  // Completed study tasks (scan a bounded recent window for recurring ones).
  const today = new Date();
  for (let i = 0; i < windowDays; i++) {
    const key = toKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i));
    for (const t of tasks) {
      if (t.type !== 'study') continue;
      if (occursOn(t, key) && isOccurrenceDone(t, key)) {
        days.add(key);
        break;
      }
    }
  }
  return days;
}

/** Consecutive-day study streak ending today (today with no study doesn't break it). */
export function studyStreak(activeDays: Set<string>, today = todayKey()): number {
  let streak = 0;
  let cursor = today;
  for (let i = 0; i < 400; i++) {
    if (activeDays.has(cursor)) {
      streak++;
    } else if (i === 0) {
      // today not yet studied — keep counting from yesterday
    } else {
      break;
    }
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

/** Total minutes logged across all sessions on/after `sinceKey`. */
export function totalMinutesSince(sessions: StudySession[], sinceKey: string): number {
  return sessions.filter((s) => s.date >= sinceKey).reduce((a, s) => a + s.minutes, 0);
}

export const RESOURCE_ICON: Record<string, string> = {
  course: '🎓',
  book: '📖',
  video: '🎬',
  article: '📰',
  link: '🔗',
};
