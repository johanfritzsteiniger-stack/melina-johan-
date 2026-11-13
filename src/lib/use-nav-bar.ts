"use client";

import { useSyncExternalStore } from "react";
import { BAR_CHOICES, BAR_SIZE, DEFAULT_BAR, MORE_ITEM, type NavItem } from "@/lib/nav";

// Welche 4 Bereiche unten am Handy stehen – pro Gerät gespeichert.
const KEY = "untere-leiste";
const listeners = new Set<() => void>();
let cacheRaw: string | null | undefined;
let cacheValue: string[] = DEFAULT_BAR;

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === cacheRaw) return cacheValue;
  cacheRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as string[]) : DEFAULT_BAR;
    const valid = parsed.filter((h) => BAR_CHOICES.some((c) => c.href === h)).slice(0, BAR_SIZE);
    cacheValue = valid.length > 0 ? valid : DEFAULT_BAR;
  } catch {
    cacheValue = DEFAULT_BAR;
  }
  return cacheValue;
}

export function setBarItems(hrefs: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(hrefs));
  } catch {
    // Speicher nicht verfügbar
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** hrefs der 4 gewählten Bereiche. */
export function useBarHrefs(): string[] {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_BAR);
}

/** Komplette untere Leiste inkl. „Mehr“. */
export function useMobileNav(): NavItem[] {
  const hrefs = useBarHrefs();
  // Reihenfolge wie in der Sidebar
  const items = BAR_CHOICES.filter((c) => hrefs.includes(c.href));
  return [...items, MORE_ITEM];
}
