"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

type Order = { column: string; ascending?: boolean };

const MIGRATION_HINT =
  "Die Datenbank ist nicht auf dem neuesten Stand. Bitte die noch nicht ausgeführten Dateien aus supabase/migrations im SQL Editor ausführen.";

/** Lädt eine Tabelle komplett und hält sie live aktuell. Für kleine Datenmengen gedacht. */
export function useTable<T>(table: string, columns: string, order: Order[] = []) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const orderKey = JSON.stringify(order);

  const load = useCallback(async () => {
    let query = getSupabase().from(table).select(columns);
    for (const o of JSON.parse(orderKey) as Order[]) {
      query = query.order(o.column, { ascending: o.ascending ?? true });
    }
    const { data, error } = await query;
    if (error) {
      setError(["42P01", "PGRST205", "42703", "PGRST204"].includes(error.code) ? MIGRATION_HINT : error.message);
    } else {
      setError(null);
      setRows((data ?? []) as T[]);
    }
    setLoading(false);
  }, [table, columns, orderKey]);

  useEffect(() => {
    const supabase = getSupabase();
    const initial = window.setTimeout(load, 0);
    const channel = supabase
      .channel(`${table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, load)
      .subscribe();
    return () => {
      window.clearTimeout(initial);
      supabase.removeChannel(channel);
    };
  }, [load, table]);

  return { rows, setRows, loading, error, reload: load };
}
