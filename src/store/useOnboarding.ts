import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OnboardingState {
  /** Becomes true once the user finishes/skips the first-run tour. */
  seen: boolean;
  /** Hydration flag so we don't flash the overlay before storage loads. */
  hydrated: boolean;
  complete: () => void;
  replay: () => void;
}

export const useOnboarding = create<OnboardingState>()(
  persist(
    (set) => ({
      seen: false,
      hydrated: false,
      complete: () => set({ seen: true }),
      replay: () => set({ seen: false }),
    }),
    {
      name: 'learnplan-onboarding-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ seen: s.seen }),
    },
  ),
);

// Mark hydrated once persisted state has loaded so the overlay only appears
// for genuine first-run users (not on every reload before storage resolves).
useOnboarding.persist.onFinishHydration(() => useOnboarding.setState({ hydrated: true }));
if (useOnboarding.persist.hasHydrated()) {
  useOnboarding.setState({ hydrated: true });
}
