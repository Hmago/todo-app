import { Platform, Share } from 'react-native';
import { Task, Category, StudySession, LearningGoal, Priority, RecurrenceFreq, ItemType } from '../types';
import { todayKey } from './dates';

type Cell = string | number | undefined | null;

function csvCell(v: Cell): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** Minimal RFC-4180-ish CSV parser supporting quotes, commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

const TASK_HEADERS = [
  'title',
  'category',
  'type',
  'date',
  'time',
  'priority',
  'recurrence',
  'important',
  'estimateMinutes',
  'tags',
  'notes',
  'completedCount',
];

export function tasksToCsv(tasks: Task[], categories: Category[]): string {
  const catName = (id?: string) => categories.find((c) => c.id === id)?.name ?? '';
  const rows: Cell[][] = [TASK_HEADERS];
  for (const t of tasks) {
    rows.push([
      t.title,
      catName(t.categoryId),
      t.type,
      t.date,
      t.time ?? '',
      t.priority,
      t.recurrence,
      t.important ? 'yes' : '',
      t.estimateMinutes ?? '',
      (t.tags ?? []).join('; '),
      t.notes ?? '',
      t.completedDates.length,
    ]);
  }
  return toCsv(rows);
}

export function sessionsToCsv(sessions: StudySession[], goals: LearningGoal[]): string {
  const goalTitle = (id?: string) => goals.find((g) => g.id === id)?.title ?? '';
  const rows: Cell[][] = [['date', 'minutes', 'goal', 'note']];
  for (const s of sessions) rows.push([s.date, s.minutes, goalTitle(s.goalId), s.note ?? '']);
  return toCsv(rows);
}

export interface ParsedTask {
  title: string;
  categoryName?: string;
  type: ItemType;
  date: string;
  time?: string;
  priority: Priority;
  recurrence: RecurrenceFreq;
  important?: boolean;
  estimateMinutes?: number;
  tags?: string[];
  notes?: string;
}

function asPriority(v: string): Priority {
  const x = v.trim().toLowerCase();
  return x === 'high' || x === 'low' ? (x as Priority) : 'medium';
}
function asRecurrence(v: string): RecurrenceFreq {
  const x = v.trim().toLowerCase();
  return x === 'daily' || x === 'weekly' || x === 'monthly' ? (x as RecurrenceFreq) : 'none';
}

/** Parse rows from a tasks CSV (header-driven) into importable task records. */
export function csvToTasks(rows: string[][]): { tasks: ParsedTask[]; errors: number } {
  if (rows.length < 2) return { tasks: [], errors: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const iTitle = idx('title');
  const iDate = idx('date');
  if (iTitle < 0) return { tasks: [], errors: rows.length - 1 };

  const tasks: ParsedTask[] = [];
  let errors = 0;
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const title = (cells[iTitle] ?? '').trim();
    if (!title) {
      errors++;
      continue;
    }
    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? (cells[i] ?? '').trim() : '';
    };
    const date = (iDate >= 0 ? cells[iDate] ?? '' : '').trim() || todayKey();
    const tagsRaw = get('tags');
    const est = parseInt(get('estimateminutes'), 10);
    const typeRaw = get('type').toLowerCase();
    tasks.push({
      title,
      categoryName: get('category') || undefined,
      type: typeRaw === 'study' ? 'study' : 'task',
      date,
      time: get('time') || undefined,
      priority: asPriority(get('priority')),
      recurrence: asRecurrence(get('recurrence')),
      important: /^(yes|true|1)$/i.test(get('important')),
      estimateMinutes: Number.isFinite(est) && est > 0 ? est : undefined,
      tags: tagsRaw ? tagsRaw.split(/[;|]/).map((x) => x.trim()).filter(Boolean) : undefined,
      notes: get('notes') || undefined,
    });
  }
  return { tasks, errors };
}

/** Trigger a file download (web) or share the text (native). */
export function downloadText(filename: string, text: string, mime = 'text/csv'): void {
  if (Platform.OS === 'web') {
    const g: any = globalThis;
    try {
      const blob = new g.Blob([text], { type: `${mime};charset=utf-8` });
      const url = g.URL.createObjectURL(blob);
      const a = g.document.createElement('a');
      a.href = url;
      a.download = filename;
      g.document.body.appendChild(a);
      a.click();
      g.document.body.removeChild(a);
      setTimeout(() => g.URL.revokeObjectURL(url), 1000);
    } catch {
      // ignore
    }
  } else {
    Share.share({ message: text, title: filename }).catch(() => {});
  }
}

/** Open a printable report window (web) so the user can save as PDF. */
export function printHtml(html: string): boolean {
  if (Platform.OS !== 'web') {
    Share.share({ message: 'PDF export is available in the web app.' }).catch(() => {});
    return false;
  }
  const g: any = globalThis;
  const w = g.window?.open('', '_blank');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch {
      // ignore
    }
  }, 250);
  return true;
}

/** Prompt the user to pick a .csv file and return its text (web only). */
export function pickCsvFile(): Promise<string | null> {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  return new Promise((resolve) => {
    const g: any = globalThis;
    const input = g.document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new g.FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}

export const isWeb = Platform.OS === 'web';
