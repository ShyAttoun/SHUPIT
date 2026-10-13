import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface State {
  /** uid of the user who has already been taken to store selection on first entry. */
  promptedFor: string | null;
  markPrompted: (uid: string) => void;
}

/** Remembers (per device and user) that the first-run store picker was already shown. */
export const useFirstRunStore = create<State>()(
  persist(
    (set) => ({
      promptedFor: null,
      markPrompted: (uid) => set({ promptedFor: uid }),
    }),
    { name: 'shupit.storesFirstRun', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/** Pure decision used by Home: show the picker once, on the first entry with no favorites. */
export function shouldPromptStores(opts: {
  loaded: boolean;
  favoriteCount: number;
  promptedFor: string | null;
  uid: string | null | undefined;
}): boolean {
  return opts.loaded && !!opts.uid && opts.favoriteCount === 0 && opts.promptedFor !== opts.uid;
}
