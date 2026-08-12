"use client";

import { useSyncExternalStore } from "react";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaInstallPlatform = "ios" | "android" | "desktop" | "standalone";

const DISMISS_KEY = "spiora-pwa-install-dismissed";

type InstallStore = {
  platform: PwaInstallPlatform;
  deferredPrompt: BeforeInstallPromptEvent | null;
  dismissed: boolean;
  narrow: boolean;
  ready: boolean;
};

let store: InstallStore = {
  platform: "desktop",
  deferredPrompt: null,
  dismissed: true,
  narrow: false,
  ready: false,
};

const listeners = new Set<() => void>();
let listenersBound = false;

function emit() {
  for (const listener of listeners) listener();
}

function setStore(patch: Partial<InstallStore>) {
  store = { ...store, ...patch };
  emit();
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function detectPwaInstallPlatform(): PwaInstallPlatform {
  if (typeof window === "undefined") return "desktop";
  if (isStandaloneDisplay()) return "standalone";

  const ua = window.navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  if (isIos) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function isNarrowViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 900px)").matches;
}

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore
  }
}

function ensureListeners() {
  if (typeof window === "undefined" || listenersBound) return;
  listenersBound = true;

  const platform = detectPwaInstallPlatform();
  setStore({
    platform,
    dismissed: readDismissed(),
    narrow: isNarrowViewport(),
    ready: true,
  });

  if (platform === "standalone") return;

  const onBeforeInstall = (event: Event) => {
    event.preventDefault();
    setStore({ deferredPrompt: event as BeforeInstallPromptEvent });
  };
  const onInstalled = () => {
    setStore({ deferredPrompt: null, platform: "standalone" });
  };
  const onResize = () => setStore({ narrow: isNarrowViewport() });

  window.addEventListener("beforeinstallprompt", onBeforeInstall);
  window.addEventListener("appinstalled", onInstalled);
  window.addEventListener("resize", onResize);
}

function subscribe(listener: () => void) {
  ensureListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): InstallStore {
  ensureListeners();
  return store;
}

function getServerSnapshot(): InstallStore {
  return {
    platform: "desktop",
    deferredPrompt: null,
    dismissed: true,
    narrow: false,
    ready: false,
  };
}

export function usePwaInstallOffer() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const canPrompt = Boolean(snapshot.deferredPrompt);
  const shouldOffer =
    snapshot.ready &&
    snapshot.platform !== "standalone" &&
    !snapshot.dismissed &&
    (canPrompt ||
      snapshot.narrow ||
      snapshot.platform === "ios" ||
      snapshot.platform === "android");

  async function promptInstall(): Promise<boolean> {
    const deferred = store.deferredPrompt;
    if (!deferred) return false;
    await deferred.prompt();
    await deferred.userChoice;
    setStore({ deferredPrompt: null });
    return true;
  }

  function dismiss() {
    writeDismissed();
    setStore({ dismissed: true });
  }

  return {
    ready: snapshot.ready,
    platform: snapshot.platform,
    canPrompt,
    shouldOffer,
    promptInstall,
    dismiss,
  };
}
