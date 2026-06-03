import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category, LearningGoal, LogEntry, Milestone, Task, StudySession, ResourceKind } from '../types';
import { uid } from '../lib/id';
import { toKey, addMonths, rollReminderToDate, todayKey } from '../lib/dates';
import { nextOccurrence } from '../lib/recurrence';
import { SR_INTERVALS, nextSrDate } from '../lib/study';

interface State {
  hydrated: boolean;
  categories: Category[];
  tasks: Task[];
  goals: LearningGoal[];
  logs: LogEntry[];
  studySessions: StudySession[];

  // category actions
  addCategory: (name: string, color: string) => string;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  // task actions
  addTask: (t: Omit<Task, 'id' | 'createdAt' | 'completedDates'>) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleComplete: (id: string, dateKey: string) => void;
  toggleImportant: (id: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  moveTask: (id: string, dir: 'up' | 'down') => void;

  // goal actions
  addGoal: (g: Omit<LearningGoal, 'id' | 'createdAt' | 'milestones'> & { milestones?: Milestone[] }) => void;
  updateGoal: (id: string, patch: Partial<LearningGoal>) => void;
  deleteGoal: (id: string) => void;
  addMilestone: (goalId: string, title: string) => void;
  toggleMilestone: (goalId: string, milestoneId: string) => void;
  deleteMilestone: (goalId: string, milestoneId: string) => void;

  // learning resource actions
  addResource: (goalId: string, kind: ResourceKind, title: string, url?: string) => void;
  toggleResource: (goalId: string, resourceId: string) => void;
  deleteResource: (goalId: string, resourceId: string) => void;

  // spaced repetition
  setGoalSR: (goalId: string, enabled: boolean) => void;
  reviewGoal: (goalId: string) => void;

  // focus / study sessions
  logStudySession: (s: { goalId?: string; taskId?: string; minutes: number; date?: string; note?: string }) => void;
  deleteStudySession: (id: string) => void;

  // daily log actions
  addLog: (date: string, text: string) => void;
  deleteLog: (id: string) => void;
}

function seedCategories(): Category[] {
  return [
    { id: 'c-work', name: 'Work', color: '#6c8cff' },
    { id: 'c-study', name: 'Study', color: '#3ecf8e' },
    { id: 'c-personal', name: 'Personal', color: '#ffb454' },
    { id: 'c-health', name: 'Health', color: '#ff6b6b' },
  ];
}

function seedTasks(): Task[] {
  return [];
}

function seedGoals(): LearningGoal[] {
  return [
    {
      id: 'g-rn',
      title: 'Master React Native',
      description: 'Build and ship a cross-platform app.',
      categoryId: 'c-study',
      targetDate: toKey(addMonths(new Date(), 2)),
      createdAt: new Date().toISOString(),
      milestones: [
        { id: uid('m-'), title: 'Core components & styling', done: true },
        { id: uid('m-'), title: 'Navigation & state', done: false },
        { id: uid('m-'), title: 'Native APIs & storage', done: false },
        { id: uid('m-'), title: 'Publish to stores', done: false },
      ],
    },
  ];
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      hydrated: false,
      categories: seedCategories(),
      tasks: seedTasks(),
      goals: seedGoals(),
      logs: [],
      studySessions: [],

      addCategory: (name, color) => {
        const id = uid('c-');
        set((s) => ({ categories: [...s.categories, { id, name, color }] }));
        return id;
      },
      updateCategory: (id, patch) =>
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),
      deleteCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          tasks: s.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: undefined } : t)),
        })),

      addTask: (t) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            { ...t, id: uid('t-'), createdAt: new Date().toISOString(), completedDates: [] },
          ],
        })),
      updateTask: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      toggleComplete: (id, dateKey) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const has = t.completedDates.includes(dateKey);
            const completedDates = has
              ? t.completedDates.filter((d) => d !== dateKey)
              : [...t.completedDates, dateKey];

            // Record / clear the wall-clock completion time used by the
            // time-of-day analytics histogram. The map is omitted entirely when
            // empty to keep persisted payloads compact.
            const prev = t.completedTimes ?? {};
            let completedTimes: Record<string, string> | undefined;
            if (has) {
              if (prev[dateKey] != null) {
                const { [dateKey]: _drop, ...rest } = prev;
                completedTimes = Object.keys(rest).length ? rest : undefined;
              } else {
                completedTimes = Object.keys(prev).length ? prev : undefined;
              }
            } else {
              const now = new Date();
              const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(
                now.getMinutes(),
              ).padStart(2, '0')}`;
              completedTimes = { ...prev, [dateKey]: hhmm };
            }

            // Roll recurring reminders forward to the next occurrence on completion.
            let reminders = t.reminders;
            if (!has && t.recurrence !== 'none' && t.reminders?.length) {
              const next = nextOccurrence(t, dateKey);
              if (next) reminders = t.reminders.map((r) => rollReminderToDate(r, next));
            }
            return { ...t, completedDates, completedTimes, reminders };
          }),
        })),

      toggleImportant: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, important: !t.important } : t)),
        })),

      toggleSubtask: (taskId, subtaskId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: (t.subtasks ?? []).map((st) =>
                    st.id === subtaskId ? { ...st, done: !st.done } : st,
                  ),
                }
              : t,
          ),
        })),

      moveTask: (id, dir) =>
        set((s) => {
          const orderVal = (t: Task) => t.order ?? Number.MAX_SAFE_INTEGER;
          const ordered = [...s.tasks].sort(
            (a, b) => orderVal(a) - orderVal(b) || b.createdAt.localeCompare(a.createdAt),
          );
          const idx = ordered.findIndex((t) => t.id === id);
          const j = dir === 'up' ? idx - 1 : idx + 1;
          if (idx < 0 || j < 0 || j >= ordered.length) return { tasks: s.tasks };
          const ids = ordered.map((t) => t.id);
          [ids[idx], ids[j]] = [ids[j], ids[idx]];
          const orderMap: Record<string, number> = {};
          ids.forEach((tid, i) => (orderMap[tid] = i));
          return { tasks: s.tasks.map((t) => ({ ...t, order: orderMap[t.id] })) };
        }),

      addGoal: (g) =>
        set((s) => ({
          goals: [
            ...s.goals,
            {
              ...g,
              id: uid('g-'),
              createdAt: new Date().toISOString(),
              milestones: g.milestones ?? [],
            },
          ],
        })),
      updateGoal: (id, patch) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
      deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      addMilestone: (goalId, title) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? { ...g, milestones: [...g.milestones, { id: uid('m-'), title, done: false }] }
              : g,
          ),
        })),
      toggleMilestone: (goalId, milestoneId) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  milestones: g.milestones.map((m) =>
                    m.id === milestoneId ? { ...m, done: !m.done } : m,
                  ),
                }
              : g,
          ),
        })),
      deleteMilestone: (goalId, milestoneId) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? { ...g, milestones: g.milestones.filter((m) => m.id !== milestoneId) }
              : g,
          ),
        })),

      addResource: (goalId, kind, title, url) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  resources: [
                    ...(g.resources ?? []),
                    { id: uid('r-'), kind, title, url: url?.trim() || undefined, done: false },
                  ],
                }
              : g,
          ),
        })),
      toggleResource: (goalId, resourceId) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  resources: (g.resources ?? []).map((r) =>
                    r.id === resourceId ? { ...r, done: !r.done } : r,
                  ),
                }
              : g,
          ),
        })),
      deleteResource: (goalId, resourceId) =>
        set((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? { ...g, resources: (g.resources ?? []).filter((r) => r.id !== resourceId) }
              : g,
          ),
        })),

      setGoalSR: (goalId, enabled) =>
        set((s) => ({
          goals: s.goals.map((g) => {
            if (g.id !== goalId) return g;
            if (!enabled) return { ...g, sr: { ...(g.sr ?? { stage: 0 }), enabled: false } };
            const today = todayKey();
            return {
              ...g,
              sr: { enabled: true, stage: 0, lastReviewed: undefined, nextReview: nextSrDate(0, today) },
            };
          }),
        })),
      reviewGoal: (goalId) =>
        set((s) => ({
          goals: s.goals.map((g) => {
            if (g.id !== goalId) return g;
            const today = todayKey();
            const cur = g.sr ?? { enabled: true, stage: 0 };
            const nextStage = Math.min(cur.stage + 1, SR_INTERVALS.length - 1);
            return {
              ...g,
              sr: {
                enabled: true,
                stage: nextStage,
                lastReviewed: today,
                nextReview: nextSrDate(nextStage, today),
              },
            };
          }),
        })),

      logStudySession: (sn) =>
        set((s) => ({
          studySessions: [
            ...s.studySessions,
            {
              id: uid('ss-'),
              goalId: sn.goalId,
              taskId: sn.taskId,
              minutes: Math.max(1, Math.round(sn.minutes)),
              date: sn.date ?? todayKey(),
              note: sn.note?.trim() || undefined,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      deleteStudySession: (id) =>
        set((s) => ({ studySessions: s.studySessions.filter((x) => x.id !== id) })),

      addLog: (date, text) =>
        set((s) => ({
          logs: [
            ...s.logs,
            { id: uid('l-'), date, text, createdAt: new Date().toISOString() },
          ],
        })),
      deleteLog: (id) => set((s) => ({ logs: s.logs.filter((l) => l.id !== id) })),
    }),
    {
      name: 'learnplan-store-v3',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ categories: s.categories, tasks: s.tasks, goals: s.goals, logs: s.logs, studySessions: s.studySessions }),
      migrate: (persisted: any, _version: number) => {
        if (persisted && Array.isArray(persisted.tasks)) {
          persisted.tasks = persisted.tasks.map((t: any) => {
            if (t && t.reminder && !t.reminders) {
              const { reminder, ...rest } = t;
              return { ...rest, reminders: [reminder] };
            }
            return t;
          });
        }
        return persisted;
      },
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);
