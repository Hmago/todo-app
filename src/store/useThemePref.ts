import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeMode } from '../theme';

interface ThemePrefState {
  /** 'system' follows the OS appearance; otherwise forced light/dark. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemePref = create<ThemePrefState>()(
  persist(
    (set) => ({
      mode: 'dark',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'learnplan-theme-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
