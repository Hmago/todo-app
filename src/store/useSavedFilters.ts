import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uid } from '../lib/id';

export type SearchStatus = 'all' | 'active' | 'done';

export interface SavedFilter {
  id: string;
  name: string;
  query: string;
  categoryId?: string;
  status: SearchStatus;
  tag?: string;
}

interface SavedFiltersState {
  filters: SavedFilter[];
  addFilter: (f: Omit<SavedFilter, 'id'>) => void;
  deleteFilter: (id: string) => void;
}

export const useSavedFilters = create<SavedFiltersState>()(
  persist(
    (set) => ({
      filters: [],
      addFilter: (f) => set((s) => ({ filters: [...s.filters, { ...f, id: uid('sf-') }] })),
      deleteFilter: (id) => set((s) => ({ filters: s.filters.filter((x) => x.id !== id) })),
    }),
    {
      name: 'learnplan-filters-v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
