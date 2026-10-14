import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface State {
  /** uid of the user who finished or skipped the tour on this device. */
  seenFor: string | null;
  /** True while the tour was reopened manually (e.g. from Settings). */
  replaying: boolean;
  markSeen: (uid: string) => void;
  replay: () => void;
  closeReplay: () => void;
}

export const useWalkthroughStore = create<State>()(
  persist(
    (set) => ({
      seenFor: null,
      replaying: false,
      markSeen: (uid) => set({ seenFor: uid, replaying: false }),
      replay: () => set({ replaying: true }),
      closeReplay: () => set({ replaying: false }),
    }),
    {
      name: 'shupit.walkthrough',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ seenFor: s.seenFor }),
    },
  ),
);

/** First entry for this user on this device, or a manual replay. */
export function shouldShowWalkthrough(opts: { uid: string | null | undefined; seenFor: string | null; replaying: boolean }) {
  return !!opts.uid && (opts.replaying || opts.seenFor !== opts.uid);
}
