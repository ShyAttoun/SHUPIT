import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // Light is the default; users can still pick dark or follow the system in Settings.
      preference: 'light',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: 'shupit.theme',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
