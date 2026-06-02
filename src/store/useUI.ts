import { create } from 'zustand';
import { Task } from '../types';
import { DraftSeed } from '../components/TaskEditorModal';

interface UIState {
  editorVisible: boolean;
  editing: Task | null;
  seed: DraftSeed | undefined;
  openNew: (seed?: DraftSeed) => void;
  openEdit: (task: Task) => void;
  closeEditor: () => void;
}

export const useUI = create<UIState>((set) => ({
  editorVisible: false,
  editing: null,
  seed: undefined,
  openNew: (seed) => set({ editorVisible: true, editing: null, seed }),
  openEdit: (task) => set({ editorVisible: true, editing: task, seed: undefined }),
  closeEditor: () => set({ editorVisible: false, editing: null, seed: undefined }),
}));
