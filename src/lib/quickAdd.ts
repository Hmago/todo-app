import { addDays, nextDay, format, Day } from 'date-fns';
import { Category, Priority, RecurrenceFreq, Task, ItemType } from '../types';
import { todayKey, toKey } from './dates';

export interface QuickParse {
  title: string;
  date?: string;
  time?: string;
  priority?: Priority;
  recurrence?: RecurrenceFreq;
  important?: boolean;
  categoryId?: string;
  tags?: string[];
}

const WEEKDAYS: Record<string, Day> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

interface Cut {
  start: number;
  end: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse a natural-language quick-add string into structured task fields. */
export function parseQuickAdd(input: string, categories: Category[] = []): QuickParse {
  const text = input;
  const cuts: Cut[] = [];
  const out: QuickParse = { title: '' };
  const now = new Date();

  const consume = (m: RegExpExecArray | null) => {
    if (m && m.index != null) cuts.push({ start: m.index, end: m.index + m[0].length });
  };

  // ---- Priority: !high / !med / !low ----
  let pm = /(^|\s)!(high|hi|h|med|medium|m|low|l)\b/i.exec(text);
  if (pm) {
    const p = pm[2].toLowerCase();
    out.priority = p.startsWith('h') ? 'high' : p.startsWith('l') ? 'low' : 'medium';
    cuts.push({ start: pm.index + pm[1].length, end: pm.index + pm[0].length });
  }
  // ---- Important: a standalone "!" or the word "important"/"!!" ----
  const im = /(^|\s)(!!|⭐|star|important)(?=\s|$)/i.exec(text);
  if (im) {
    out.important = true;
    cuts.push({ start: im.index + im[1].length, end: im.index + im[0].length });
  }

  // ---- Tags & category via #token ----
  const tags: string[] = [];
  const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const tagRe = /(^|\s)#([\p{L}\p{N}_-]+)/giu;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(text)) !== null) {
    const raw = tm[2];
    const catId = catByName.get(raw.toLowerCase());
    if (catId && !out.categoryId) out.categoryId = catId;
    else tags.push(raw);
    cuts.push({ start: tm.index + tm[1].length, end: tm.index + tm[0].length });
  }
  if (tags.length) out.tags = tags;

  // ---- Recurrence ----
  let rec = /\b(every\s*day|everyday|daily)\b/i.exec(text);
  if (rec) {
    out.recurrence = 'daily';
    consume(rec);
  } else if ((rec = /\b(every\s*week|weekly)\b/i.exec(text))) {
    out.recurrence = 'weekly';
    consume(rec);
  } else if ((rec = /\b(every\s*month|monthly)\b/i.exec(text))) {
    out.recurrence = 'monthly';
    consume(rec);
  } else if ((rec = /\bevery\s+(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)[a-z]*\b/i.exec(text))) {
    out.recurrence = 'weekly';
    const d = WEEKDAYS[rec[1].toLowerCase()];
    if (d != null) out.date = toKey(nextDay(now, d));
    consume(rec);
  }

  // ---- Time: 6pm / 6:30 pm / 18:30 / at 6 ----
  let timeKey: string | undefined;
  let t12 = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(text);
  if (t12) {
    let h = parseInt(t12[1], 10) % 12;
    if (t12[3].toLowerCase() === 'pm') h += 12;
    const mn = t12[2] ? parseInt(t12[2], 10) : 0;
    timeKey = `${pad2(h)}:${pad2(mn)}`;
    consume(t12);
  } else {
    const t24 = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
    if (t24) {
      timeKey = `${pad2(parseInt(t24[1], 10))}:${t24[2]}`;
      consume(t24);
    } else {
      const atH = /\bat\s+(\d{1,2})\b/i.exec(text);
      if (atH) {
        const h = parseInt(atH[1], 10);
        if (h >= 0 && h <= 23) {
          timeKey = `${pad2(h)}:00`;
          consume(atH);
        }
      }
    }
  }
  if (timeKey) out.time = timeKey;

  // ---- Date keywords (only if not already set by "every <weekday>") ----
  if (!out.date) {
    let dm: RegExpExecArray | null;
    if ((dm = /\b(today|tonight)\b/i.exec(text))) {
      out.date = todayKey();
      if (dm[1].toLowerCase() === 'tonight' && !out.time) out.time = '20:00';
      consume(dm);
    } else if ((dm = /\b(tomorrow|tmrw|tmr)\b/i.exec(text))) {
      out.date = toKey(addDays(now, 1));
      consume(dm);
    } else if ((dm = /\b(yesterday)\b/i.exec(text))) {
      out.date = toKey(addDays(now, -1));
      consume(dm);
    } else if ((dm = /\bin\s+(\d{1,3})\s+(day|days|week|weeks)\b/i.exec(text))) {
      const n = parseInt(dm[1], 10) * (/week/i.test(dm[2]) ? 7 : 1);
      out.date = toKey(addDays(now, n));
      consume(dm);
    } else if ((dm = /\b(?:next\s+)?(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday)?\b/i.exec(text))) {
      const d = WEEKDAYS[dm[1].toLowerCase()];
      if (d != null) {
        out.date = toKey(nextDay(now, d));
        consume(dm);
      }
    } else if ((dm = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text))) {
      out.date = `${dm[1]}-${dm[2]}-${dm[3]}`;
      consume(dm);
    } else if (
      (dm = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})\b/i.exec(text))
    ) {
      const mo = MONTHS[dm[1].toLowerCase()];
      const day = parseInt(dm[2], 10);
      if (mo != null && day >= 1 && day <= 31) {
        let y = now.getFullYear();
        if (mo < now.getMonth() || (mo === now.getMonth() && day < now.getDate())) y++;
        out.date = `${y}-${pad2(mo + 1)}-${pad2(day)}`;
        consume(dm);
      }
    } else if ((dm = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/i.exec(text))) {
      const day = parseInt(dm[1], 10);
      const mo = MONTHS[dm[2].toLowerCase()];
      if (mo != null && day >= 1 && day <= 31) {
        let y = now.getFullYear();
        if (mo < now.getMonth() || (mo === now.getMonth() && day < now.getDate())) y++;
        out.date = `${y}-${pad2(mo + 1)}-${pad2(day)}`;
        consume(dm);
      }
    }
  }

  // ---- Build cleaned title ----
  cuts.sort((a, b) => a.start - b.start);
  let title = '';
  let cursor = 0;
  for (const c of cuts) {
    if (c.start > cursor) title += text.slice(cursor, c.start);
    cursor = Math.max(cursor, c.end);
  }
  title += text.slice(cursor);
  out.title = title.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
  if (!out.title) out.title = input.trim();
  return out;
}

/** Merge a parsed quick-add over base defaults into an addTask payload. */
export function quickAddToTask(
  input: string,
  base: { date: string; type?: ItemType; categoryId?: string; important?: boolean; goalId?: string },
  categories: Category[] = [],
): Omit<Task, 'id' | 'createdAt' | 'completedDates'> {
  const p = parseQuickAdd(input, categories);
  return {
    title: p.title,
    date: p.date ?? base.date,
    time: p.time,
    allDay: p.time ? false : undefined,
    priority: p.priority ?? 'medium',
    recurrence: p.recurrence ?? 'none',
    important: p.important || base.important || undefined,
    categoryId: p.categoryId ?? base.categoryId,
    tags: p.tags,
    type: base.type ?? 'task',
    goalId: base.goalId,
  };
}

/** Short human summary of detected fields, for a live preview. */
export function describeParse(p: QuickParse, categories: Category[] = []): string[] {
  const chips: string[] = [];
  if (p.date) chips.push(`📅 ${format(new Date(p.date + 'T00:00:00'), 'EEE, MMM d')}`);
  if (p.time) chips.push(`⏰ ${p.time}`);
  if (p.recurrence && p.recurrence !== 'none') chips.push(`🔁 ${p.recurrence}`);
  if (p.priority) chips.push(`${p.priority === 'high' ? '🔴' : p.priority === 'low' ? '🟢' : '🟡'} ${p.priority}`);
  if (p.important) chips.push('⭐ important');
  if (p.categoryId) {
    const c = categories.find((x) => x.id === p.categoryId);
    if (c) chips.push(`📁 ${c.name}`);
  }
  if (p.tags?.length) chips.push(...p.tags.map((t) => `#${t}`));
  return chips;
}
