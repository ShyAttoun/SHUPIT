import { createContext, useContext } from 'react';
import type { View } from 'react-native';

type EnsureVisible = (target: View | null) => void;

/** Lets inputs ask the enclosing scrolling Screen to bring them above the keyboard. */
export const ScreenScrollContext = createContext<EnsureVisible>(() => {});
export const useEnsureVisible = () => useContext(ScreenScrollContext);
