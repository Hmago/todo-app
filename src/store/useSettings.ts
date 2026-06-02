import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task } from '../types';
import { minutesOfDay } from '../lib/dates';

export interface NotifSettings {
  /** Master switch for all notifications (OS + in-app banners + agenda). */
  enabled: boolean;
  quietHoursEnabled: boolean;
  /** 'HH:mm' */
  quietStart: string;
  quietEnd: string;
  /** Daily "My Day" summary. */
  agendaEnabled: boolean;
  agendaTime: string;
  /** Category ids whose reminders are muted. Uncategorised uses 'none'. */
  mutedCategories: string[];
}

interface SettingsState extends NotifSettings {
  setEnabled: (v: boolean) => void;
  setQuietHoursEnabled: (v: boolean) => void;
  setQuietHours: (start: string, end: string) => void;
  setAgendaEnabled: (v: boolean) => void;
  setAgendaTime: (t: string) => void;
  toggleCategoryMuted: (categoryId: string) => void;
}

const DEFAULTS: NotifSettings = {
  enabled: true,
  quietHoursEnabled: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  agendaEnabled: false,
  agendaTime: '08:00',
  mutedCategories: [],
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setEnabled: (v) => set({ enabled: v }),
      setQuietHoursEnabled: (v) => set({ quietHoursEnabled: v }),
      setQuietHours: (start, end) => set({ quietStart: start, quietEnd: end }),
      setAgendaEnabled: (v) => set({ agendaEnabled: v }),
      setAgendaTime: (t) => set({ agendaTime: t }),
      toggleCategoryMuted: (categoryId) =>
        set((s) => ({
          mutedCategories: s.mutedCategories.includes(categoryId)
            ? s.mutedCategories.filter((c) => c !== categoryId)
            : [...s.mutedCategories, categoryId],
        })),
    }),
    {
      name: 'learnplan-notif-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// ---- Pure rule helpers (usable outside React) ----

export function categoryKey(task: Pick<Task, 'categoryId'>): string {
  return task.categoryId ?? 'none';
}

export function isCategoryMuted(settings: NotifSettings, task: Pick<Task, 'categoryId'>): boolean {
  return settings.mutedCategories.includes(categoryKey(task));
}

/** Is `when` inside the configured quiet-hours window (supports overnight ranges)? */
export function inQuietHours(when: Date, settings: NotifSettings): boolean {
  if (!settings.quietHoursEnabled) return false;
  const start = minutesOfDay(settings.quietStart);
  const end = minutesOfDay(settings.quietEnd);
  if (start == null || end == null || start === end) return false;
  const cur = when.getHours() * 60 + when.getMinutes();
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

/** Should a reminder for this task be delivered at `when`? */
export function shouldNotify(
  settings: NotifSettings,
  task: Pick<Task, 'categoryId'>,
  when: Date,
): boolean {
  if (!settings.enabled) return false;
  if (isCategoryMuted(settings, task)) return false;
  if (inQuietHours(when, settings)) return false;
  return true;
}
