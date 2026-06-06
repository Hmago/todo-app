import { differenceInCalendarDays } from 'date-fns';
import { fromKey, todayKey } from './dates';

export interface DateBucket {
  /** Sort key; lower = earlier in the rendered list (Upcoming → Today → … → Older). */
  order: number;
  label: string;
}

const UPCOMING: DateBucket  = { order: -1, label: 'Upcoming' };
const TODAY: DateBucket     = { order: 0,  label: 'Today' };
const YESTERDAY: DateBucket = { order: 1,  label: 'Yesterday' };
const LAST_WEEK: DateBucket = { order: 2,  label: 'Last week' };
const LAST_MONTH: DateBucket = { order: 3, label: 'Last month' };
const OLDER: DateBucket     = { order: 4,  label: 'Older' };

/**
 * Outlook-style time bucket for a 'yyyy-MM-dd' date relative to today:
 *   Upcoming (any future date) → Today → Yesterday →
 *   Last week (2–7 days ago) → Last month (8–30 days ago) → Older (>30 days).
 *
 * Used to group completed / skipped task lists into time slices so older items
 * collapse together (mirroring how Outlook groups older emails).
 */
export function bucketByDate(dateKey: string, today: string = todayKey()): DateBucket {
  if (dateKey > today) return UPCOMING;
  if (dateKey === today) return TODAY;
  const diff = differenceInCalendarDays(fromKey(today), fromKey(dateKey));
  if (diff <= 0) return TODAY;
  if (diff === 1) return YESTERDAY;
  if (diff <= 7) return LAST_WEEK;
  if (diff <= 30) return LAST_MONTH;
  return OLDER;
}
