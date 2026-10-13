import { create } from 'zustand';
import type { PickedImage } from './imagePicker';

/** Content handed from the share screen (or a PWA share target) to the add-product/add-order screens. */
export interface ShareInbox {
  image?: PickedImage;
  text?: string;
  url?: string;
}

interface State {
  inbox: ShareInbox | null;
  set: (v: ShareInbox) => void;
  /** Returns the inbox once and clears it. */
  take: () => ShareInbox | null;
}

export const useShareInbox = create<State>((set, get) => ({
  inbox: null,
  set: (v) => set({ inbox: v }),
  take: () => {
    const v = get().inbox;
    if (v) set({ inbox: null });
    return v;
  },
}));

const URL_RE = /https?:\/\/[^\s<>"')]+/i;

/** First http(s) URL found in any of the strings (Android often puts the link inside `text`). */
export function firstUrl(...parts: (string | undefined | null)[]): string | undefined {
  for (const p of parts) {
    const m = p ? URL_RE.exec(p) : null;
    if (m) return m[0].replace(/[.,;:!?]+$/, '');
  }
  return undefined;
}
