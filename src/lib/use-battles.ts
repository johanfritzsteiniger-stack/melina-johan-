"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { Battle, Entry } from "@/lib/battles";

export const BATTLE_COLUMNS =
  "id, name, emoji, unit, period, aggregate, higher_wins, archived, sort";
export const ENTRY_COLUMNS = "id, battle_id, person_id, date, value, note, created_at";

/** Alle Battles und Einträge, live aktualisiert. */
export function useBattles() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    const [b, e] = await Promise.all([
      supabase.from("battles").select(BATTLE_COLUMNS).order("sort").order("created_at"),
      supabase.from("battle_entries").select(ENTRY_COLUMNS).order("date", { ascending: false }),
    ]);
    const err = b.error ?? e.error;
    if (err) {
      setError(
        ["42P01", "PGRST205", "42703", "PGRST204"].includes(err.code)
          ? "Die Datenbank ist nicht auf dem neuesten Stand. Bitte supabase/migrations/0005_battles.sql im SQL Editor ausführen."
          : err.message,
      );
    } else {
      setError(null);
      setBattles((b.data ?? []) as Battle[]);
      setEntries(
        ((e.data ?? []) as Entry[]).map((x) => ({ ...x, value: Number(x.value) })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    const initial = window.setTimeout(load, 0);
    const channel = supabase
      .channel(`battles-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "battles" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "battle_entries" }, load)
      .subscribe();
    return () => {
      window.clearTimeout(initial);
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { battles, entries, loading, error, reload: load };
}
