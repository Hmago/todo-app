import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UIPrefsState {
  /** Hide overdue (past-date pending) tasks from the My Day list. */
  hideOverdueInMyDay: boolean;
  setHideOverdueInMyDay: (v: boolean) => void;
  toggleHideOverdueInMyDay: () => void;
  /** Collapse the completed + skipped section in task lists. Default: collapsed. */
  completedCollapsed: boolean;
  setCompletedCollapsed: (v: boolean) => void;
  toggleCompletedCollapsed: () => void;
}

export const useUIPrefs = create<UIPrefsState>()(
  persist(
    (set) => ({
      hideOverdueInMyDay: false,
      setHideOverdueInMyDay: (v) => set({ hideOverdueInMyDay: v }),
      toggleHideOverdueInMyDay: () =>
        set((s) => ({ hideOverdueInMyDay: !s.hideOverdueInMyDay })),
      completedCollapsed: true,
      setCompletedCollapsed: (v) => set({ completedCollapsed: v }),
      toggleCompletedCollapsed: () =>
        set((s) => ({ completedCollapsed: !s.completedCollapsed })),
    }),
    {
      name: 'learnplan-uiprefs-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
