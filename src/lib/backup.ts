import { Platform, Share } from 'react-native';
import { useStore } from '../store/useStore';
import { useSettings, NotifSettings } from '../store/useSettings';
import { useSavedFilters, SavedFilter } from '../store/useSavedFilters';
import { Category, Task, LearningGoal, LogEntry, StudySession } from '../types';
import { todayKey } from './dates';
import { downloadText } from './dataio';

export const BACKUP_TYPE = 'learnplan-backup';
export const BACKUP_VERSION = 1;

export interface BackupData {
  categories: Category[];
  tasks: Task[];
  goals: LearningGoal[];
  logs: LogEntry[];
  studySessions: StudySession[];
  settings: NotifSettings;
  savedFilters: SavedFilter[];
}

export interface Backup {
  app: 'To Do';
  type: typeof BACKUP_TYPE;
  version: number;
  exportedAt: string;
  data: BackupData;
}

const NOTIF_KEYS: (keyof NotifSettings)[] = [
  'enabled',
  'quietHoursEnabled',
  'quietStart',
  'quietEnd',
  'agendaEnabled',
  'agendaTime',
  'mutedCategories',
];

function pickSettings(s: any): NotifSettings {
  const out: any = {};
  for (const k of NOTIF_KEYS) out[k] = s[k];
  return out as NotifSettings;
}

/** Snapshot every store into a single versioned backup object. */
export function buildBackup(): Backup {
  const store = useStore.getState();
  const settings = useSettings.getState();
  const filters = useSavedFilters.getState();
  return {
    app: 'To Do',
    type: BACKUP_TYPE,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      categories: store.categories,
      tasks: store.tasks,
      goals: store.goals,
      logs: store.logs,
      studySessions: store.studySessions,
      settings: pickSettings(settings),
      savedFilters: filters.filters,
    },
  };
}

export interface BackupSummary {
  tasks: number;
  categories: number;
  goals: number;
  logs: number;
  studySessions: number;
  savedFilters: number;
}

export function summarize(b: Backup): BackupSummary {
  const d = b.data;
  return {
    tasks: d.tasks?.length ?? 0,
    categories: d.categories?.length ?? 0,
    goals: d.goals?.length ?? 0,
    logs: d.logs?.length ?? 0,
    studySessions: d.studySessions?.length ?? 0,
    savedFilters: d.savedFilters?.length ?? 0,
  };
}

/** Trigger a download (web) or share sheet (native) of the JSON backup. */
export function exportBackup(): void {
  const json = JSON.stringify(buildBackup(), null, 2);
  downloadText(`todo-backup-${todayKey()}.json`, json, 'application/json');
}

export interface ParseResult {
  ok: boolean;
  error?: string;
  backup?: Backup;
  summary?: BackupSummary;
}

/** Validate raw text and return a typed backup (does not apply it). */
export function parseBackup(text: string): ParseResult {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file isn’t valid JSON.' };
  }
  if (!raw || typeof raw !== 'object' || raw.type !== BACKUP_TYPE || !raw.data) {
    return { ok: false, error: 'This doesn’t look like a To Do backup file.' };
  }
  const d = raw.data;
  if (!Array.isArray(d.tasks) || !Array.isArray(d.categories)) {
    return { ok: false, error: 'Backup is missing tasks or lists.' };
  }
  // Fill any missing collections so a partial/old backup still restores cleanly.
  d.goals = Array.isArray(d.goals) ? d.goals : [];
  d.logs = Array.isArray(d.logs) ? d.logs : [];
  d.studySessions = Array.isArray(d.studySessions) ? d.studySessions : [];
  d.savedFilters = Array.isArray(d.savedFilters) ? d.savedFilters : [];
  const backup = raw as Backup;
  return { ok: true, backup, summary: summarize(backup) };
}

/** Overwrite all stores with the backup contents. Replaces existing data. */
export function applyBackup(backup: Backup): void {
  const d = backup.data;
  useStore.setState({
    categories: d.categories,
    tasks: d.tasks,
    goals: d.goals,
    logs: d.logs,
    studySessions: d.studySessions,
  });
  if (d.settings) useSettings.setState(pickSettings(d.settings));
  useSavedFilters.setState({ filters: d.savedFilters ?? [] });
}

/** Convenience: parse + apply in one step. */
export function importBackup(text: string): ParseResult {
  const res = parseBackup(text);
  if (res.ok && res.backup) applyBackup(res.backup);
  return res;
}

/** Prompt the user to pick a .json file and return its text (web only). */
export function pickJsonFile(): Promise<string | null> {
  if (Platform.OS !== 'web') return Promise.resolve(null);
  return new Promise((resolve) => {
    const g: any = globalThis;
    const input = g.document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new g.FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}

export const canPickFile = Platform.OS === 'web';
