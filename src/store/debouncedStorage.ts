import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

/**
 * A debounced JSON-backed PersistStorage for Zustand.
 *
 * Why a custom storage rather than `createJSONStorage(() => AsyncStorage)`?
 * Zustand calls `setItem` on every state mutation. With the default JSON storage,
 * each mutation triggers a synchronous `JSON.stringify` of the full persisted
 * slice (~all tasks, goals, etc.) followed by a write to AsyncStorage. With this
 * wrapper, both the stringify and the underlying write are coalesced into a
 * single trailing-edge debounced flush, so a burst of rapid changes (typing in
 * an inline editor, dragging a task to reorder, keyboard undo/redo) does a
 * single serialize/write per ~250ms window instead of one per keystroke.
 *
 * Safety:
 * - We flush synchronously on `pagehide` / `beforeunload` (web/Electron) so a
 *   reload or close does not lose buffered state. On native we accept best-effort
 *   semantics (Zustand's default behavior is also best-effort on hard kill).
 * - `getItem` is not debounced — first paint and rehydration are unaffected.
 * - `removeItem` cancels any pending write before removing.
 */
export function createDebouncedAsyncStorage<T>(delayMs = 250): PersistStorage<T> {
  let pendingValue: StorageValue<T> | null = null;
  let pendingName: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const writeNow = async (name: string, value: StorageValue<T>) => {
    try {
      const str = JSON.stringify(value);
      await AsyncStorage.setItem(name, str);
    } catch {
      /* best effort */
    }
  };

  const flush = () => {
    timer = null;
    if (!pendingName || !pendingValue) return;
    const name = pendingName;
    const value = pendingValue;
    pendingName = null;
    pendingValue = null;
    void writeNow(name, value);
  };

  const flushSync = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pendingName || !pendingValue) return;
    const name = pendingName;
    const value = pendingValue;
    pendingName = null;
    pendingValue = null;
    try {
      const str = JSON.stringify(value);
      // Prefer synchronous localStorage on unload — AsyncStorage's web shim is
      // promise-wrapped and may not resolve before the page is torn down.
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(name, str);
          return;
        } catch {
          /* quota / disabled — fall back */
        }
      }
      // Native or no localStorage: best-effort async write.
      void AsyncStorage.setItem(name, str);
    } catch {
      /* swallow */
    }
  };

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    // pagehide is the modern, more reliable event; beforeunload covers older paths.
    window.addEventListener('pagehide', flushSync);
    window.addEventListener('beforeunload', flushSync);
  }

  return {
    getItem: async (name: string): Promise<StorageValue<T> | null> => {
      try {
        const raw = await AsyncStorage.getItem(name);
        if (raw == null) return null;
        return JSON.parse(raw) as StorageValue<T>;
      } catch {
        return null;
      }
    },
    setItem: (name: string, value: StorageValue<T>) => {
      pendingName = name;
      pendingValue = value;
      if (timer === null) {
        timer = setTimeout(flush, delayMs);
      }
    },
    removeItem: async (name: string) => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (pendingName === name) {
        pendingName = null;
        pendingValue = null;
      }
      try {
        await AsyncStorage.removeItem(name);
      } catch {
        /* best effort */
      }
    },
  };
}
