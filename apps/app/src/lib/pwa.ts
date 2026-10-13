import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

/** Registers the service worker (production hosts only; localhost dev keeps its own cache rules). */
export function registerServiceWorker() {
  if (!isWeb || !('serviceWorker' in navigator)) return;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

/** Captures Chrome's install prompt so it can be shown from our own UI. */
export function initInstallPrompt() {
  if (!isWeb) return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  if (!isWeb) return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (!isWeb) return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return {
    standalone: isStandalone(),
    ios: isIos(),
    canPrompt: !!deferred,
    prompt: async () => {
      if (!deferred) return 'dismissed' as const;
      await deferred.prompt();
      const choice = await deferred.userChoice;
      deferred = null;
      notify();
      return choice.outcome;
    },
  };
}
