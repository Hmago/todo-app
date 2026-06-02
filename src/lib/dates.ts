import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  addDays,
  addWeeks,
  isSameDay,
  isToday as dfIsToday,
} from 'date-fns';

export const ISO = 'yyyy-MM-dd';

export function toKey(d: Date): string {
  return format(d, ISO);
}

export function fromKey(key: string): Date {
  return parseISO(key);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function prettyDate(key: string): string {
  return format(fromKey(key), 'EEE, MMM d');
}

export function prettyMonth(d: Date): string {
  return format(d, 'MMMM yyyy');
}

export function pretty12h(time?: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a Date as a local 'yyyy-MM-ddTHH:mm' string (no timezone). */
export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours(),
  )}:${pad2(d.getMinutes())}`;
}

/** Human-friendly reminder label, e.g. "Jun 2, 6:00 PM" or "Today, 6:00 PM". */
export function prettyReminder(iso: string): string {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = isSameDay(d, new Date()) ? 'Today' : format(d, 'MMM d');
  return `${day}, ${format(d, 'h:mm a')}`;
}

/** Replace the date portion of a reminder ISO, keeping the time-of-day. */
export function rollReminderToDate(reminderIso: string, dateKey: string): string {
  const time = reminderIso.includes('T') ? reminderIso.slice(11, 16) : '09:00';
  return `${dateKey}T${time}`;
}

/** Parse 'HH:mm' into minutes since midnight; returns null if invalid. */
export function minutesOfDay(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Format a minute count as "1h 30m" / "45m" / "2h". */
export function prettyDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Returns the 6-week grid (42 days) that contains the given month. */
export function monthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

/** The 7 day keys of the week (Sun..Sat) containing `d`. */
export function weekDays(d: Date): string[] {
  const start = startOfWeek(d, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => toKey(addDays(start, i)));
}

/** Pretty range label for the week containing `d`, e.g. "Jun 1 – 7" or "May 28 – Jun 3". */
export function prettyWeekRange(d: Date): string {
  const start = startOfWeek(d, { weekStartsOn: 0 });
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, 'MMM d')} – ${format(end, 'd')}`;
  }
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
}

/** Long day label, e.g. "Tuesday, June 2". */
export function prettyDayLong(key: string): string {
  return format(fromKey(key), 'EEEE, MMMM d');
}

/** Short weekday + day, e.g. "Tue 2". */
export function prettyDayShort(key: string): string {
  return format(fromKey(key), 'EEE d');
}

/** Shift a 'yyyy-MM-dd' key by a number of days. */
export function shiftDateKey(key: string, days: number): string {
  return toKey(addDays(fromKey(key), days));
}

export { addMonths, addDays, addWeeks, isSameDay, dfIsToday as isToday, startOfMonth };
