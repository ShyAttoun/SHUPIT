import { create } from 'zustand';
import type { PickedImage } from './imagePicker';

/** Content received through the OS share sheet (native), waiting for the share screen. */
export interface IncomingShare {
  title?: string;
  text?: string;
  url?: string;
  image?: PickedImage;
}

interface State {
  incoming: IncomingShare | null;
  set: (v: IncomingShare) => void;
  take: () => IncomingShare | null;
}

export const useIncomingShare = create<State>((set, get) => ({
  incoming: null,
  set: (v) => set({ incoming: v }),
  take: () => {
    const v = get().incoming;
    if (v) set({ incoming: null });
    return v;
  },
}));
