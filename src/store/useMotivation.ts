import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MotivationState {
  /** Quote ids the user has favorited. */
  favorites: string[];
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

export const useMotivation = create<MotivationState>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),
      isFavorite: (id) => get().favorites.includes(id),
    }),
    {
      name: 'learnplan-motivation-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ favorites: s.favorites }),
    },
  ),
);
