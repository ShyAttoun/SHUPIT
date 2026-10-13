import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LanguagePreference = 'system' | 'he' | 'en';

interface LanguageState {
  preference: LanguagePreference;
  setPreference: (p: LanguagePreference) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: 'shupit.language',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
