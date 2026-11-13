"use client";

import { useCallback, useSyncExternalStore } from "react";

// Kleine Einstellungen pro Gerät (z. B. gewählte Kalenderansicht).
const listeners = new Set<() => void>();

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLocalSetting<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        const v = localStorage.getItem(key) as T | null;
        return v && allowed.includes(v) ? v : fallback;
      } catch {
        return fallback;
      }
    },
    () => fallback,
  );
  const set = useCallback(
    (v: T) => {
      try {
        localStorage.setItem(key, v);
      } catch {
        // Speicher nicht verfügbar
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set] as const;
}
