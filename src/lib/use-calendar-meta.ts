"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { CalendarEvent, Category } from "@/lib/calendar";

export type Person = { id: string; display_name: string; color: string | null };
export type ColorMode = "person" | "category";

const FALLBACK_SHARED = "#8b5cf6";
const FALLBACK_PERSON = "#0ea5e9";
const NO_CATEGORY = "#a1a1aa";

// ---------- Färben nach (pro Gerät gespeichert) ----------

const MODE_KEY = "kalender-farbe-nach";
const modeListeners = new Set<() => void>();

function readMode(): ColorMode {
  try {
    return localStorage.getItem(MODE_KEY) === "category" ? "category" : "person";
  } catch {
    return "person";
  }
}

export function setColorMode(mode: ColorMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Speicher nicht verfügbar – dann gilt es nur bis zum Neuladen nicht
  }
  modeListeners.forEach((l) => l());
}

function subscribeMode(l: () => void) {
  modeListeners.add(l);
  return () => modeListeners.delete(l);
}

export function useColorMode(): ColorMode {
  return useSyncExternalStore(subscribeMode, readMode, () => "person");
}

// ---------- Kategorien, Personen, gemeinsame Farbe ----------

/** Lädt Kategorien, Personen und Farben – live aktualisiert. */
export function useCalendarMeta() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [sharedColor, setSharedColor] = useState(FALLBACK_SHARED);
  const [loaded, setLoaded] = useState(false);
  const mode = useColorMode();

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [cats, profs, settings] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, color, is_birthday, is_countdown, sort")
        .order("sort")
        .order("created_at"),
      supabase.from("profiles").select("id, display_name, color").order("created_at"),
      supabase.from("app_settings").select("key, value").eq("key", "shared_color"),
    ]);
    setCategories((cats.data ?? []) as Category[]);
    setPeople((profs.data ?? []) as Person[]);
    setSharedColor(settings.data?.[0]?.value ?? FALLBACK_SHARED);
    setLoaded(true);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    // Erstes Laden; danach bei jeder Änderung neu laden (sind nur wenige Zeilen)
    const initial = window.setTimeout(load, 0);
    const channel = supabase
      .channel(`meta-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, load)
      .subscribe();
    return () => {
      window.clearTimeout(initial);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const helpers = useMemo(() => {
    const catById = new Map(categories.map((c) => [c.id, c]));
    const personById = new Map(people.map((p) => [p.id, p]));

    const categoryOf = (e: CalendarEvent) =>
      e.category_id ? catById.get(e.category_id) : undefined;

    const personColor = (ownerId: string | null) =>
      ownerId === null
        ? sharedColor
        : (personById.get(ownerId)?.color ?? FALLBACK_PERSON);

    /** "Johan", "Melina", "Beide" oder "" (keine Person). */
    const ownerLabel = (e: CalendarEvent) =>
      e.owner_id
        ? (personById.get(e.owner_id)?.display_name ?? "?")
        : e.shared
          ? "Beide"
          : "";

    const hasPerson = (e: CalendarEvent) => Boolean(e.owner_id) || e.shared;

    // Ohne Person (oder im Modus "Kategorie") gilt immer die Kategoriefarbe
    const colorOf = (e: CalendarEvent) =>
      mode === "person" && hasPerson(e)
        ? personColor(e.owner_id)
        : (categoryOf(e)?.color ?? NO_CATEGORY);

    return { categoryOf, personColor, ownerLabel, colorOf };
  }, [categories, people, sharedColor, mode]);

  return { categories, people, sharedColor, mode, loaded, reload: load, ...helpers };
}
