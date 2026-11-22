"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { subscribeRefresh } from "@/lib/table-bus";

export type CoffeeDay = { user_id: string; day: string; cups: number };

/** Kaffee pro Person und Tag im angegebenen Jahr, live aktuell. */
export function useCoffeeYear(year: number | null) {
  const [days, setDays] = useState<CoffeeDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    if (!year) return;
    const { data, error } = await getSupabase().rpc("coffee_year", { y: year });
    if (error) {
      if (["42P01", "PGRST202", "PGRST205", "42883"].includes(error.code)) {
        setError("Für den Kaffee-Zähler bitte supabase/migrations/0010_coffee.sql im SQL Editor ausführen.");
      } else if (!loaded.current) {
        setError(error.message);
      } // sonst: kurzer Netzaussetzer – bisherige Zahlen stehen lassen
    } else {
      loaded.current = true;
      setError(null);
      setDays((data ?? []) as CoffeeDay[]);
    }
    setLoading(false);
  }, [year]);

  useEffect(() => {
    if (!year) return;
    const supabase = getSupabase();
    const initial = window.setTimeout(load, 0);
    const channel = supabase
      .channel(`coffees-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "coffees" }, load)
      .subscribe();
    const off = subscribeRefresh(["coffees"], load);
    return () => {
      off();
      window.clearTimeout(initial);
      supabase.removeChannel(channel);
    };
  }, [load, year]);

  return { days, setDays, loading, error };
}
