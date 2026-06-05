import { create } from 'zustand';
import { Task } from '../types';

export interface TaskSnapshot {
  label: string;
  tasks: Task[];
}

export interface HistoryEvent {
  kind: 'push' | 'undo' | 'redo';
  label: string;
  seq: number;
}

interface HistoryState {
  undoStack: TaskSnapshot[];
  redoStack: TaskSnapshot[];
  /** Latest history transition, observed by the undo toast / status UI. */
  lastEvent: HistoryEvent | null;
  push: (label: string, prevTasks: Task[]) => void;
  /** Pops the top of the undo stack and pushes `currentTasks` onto the redo
   *  stack. Returns the snapshot the caller should apply to the data store, or
   *  null if there is nothing to undo. */
  popUndo: (currentTasks: Task[]) => TaskSnapshot | null;
  popRedo: (currentTasks: Task[]) => TaskSnapshot | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

const HISTORY_LIMIT = 100;
let seq = 0;

export const useHistory = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  lastEvent: null,

  push: (label, prevTasks) => {
    const snapshot: TaskSnapshot = { label, tasks: prevTasks };
    set((s) => {
      const next = [...s.undoStack, snapshot];
      if (next.length > HISTORY_LIMIT) next.shift();
      return { undoStack: next, redoStack: [], lastEvent: { kind: 'push', label, seq: ++seq } };
    });
  },

  popUndo: (currentTasks) => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return null;
    const newUndo = [...undoStack];
    const entry = newUndo.pop()!;
    set({
      undoStack: newUndo,
      redoStack: [...redoStack, { label: entry.label, tasks: currentTasks }],
      lastEvent: { kind: 'undo', label: entry.label, seq: ++seq },
    });
    return entry;
  },

  popRedo: (currentTasks) => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return null;
    const newRedo = [...redoStack];
    const entry = newRedo.pop()!;
    set({
      undoStack: [...undoStack, { label: entry.label, tasks: currentTasks }],
      redoStack: newRedo,
      lastEvent: { kind: 'redo', label: entry.label, seq: ++seq },
    });
    return entry;
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
  clear: () => set({ undoStack: [], redoStack: [], lastEvent: null }),
}));

/** Helper meant to be called inside a `set((s) => ...)` of useStore, BEFORE
 *  returning the new state. Captures the *current* tasks array as the snapshot
 *  the user can revert to. */
export function recordHistory(label: string, prevTasks: Task[]): void {
  useHistory.getState().push(label, prevTasks);
}

