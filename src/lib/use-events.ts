"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { CalendarEvent } from "@/lib/calendar";

const COLUMNS =
  "id, title, category_id, owner_id, shared, start_date, end_date, start_time, end_time, recurrence, location, notes, is_countdown, created_by";

/** Lädt alle Termine und hält sie live aktuell (Änderungen des anderen erscheinen sofort). */
export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    supabase
      .from("events")
      .select(COLUMNS)
      .order("start_date")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError(
            ["42P01", "PGRST205", "42703", "PGRST204"].includes(error.code)
              ? "Die Datenbank ist nicht auf dem neuesten Stand. Bitte die noch nicht ausgeführten Dateien aus supabase/migrations im SQL Editor ausführen."
              : error.message,
          );
        } else {
          setEvents((data ?? []) as CalendarEvent[]);
        }
        setLoading(false);
      });

    const channel = supabase
      .channel("events-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          setEvents((current) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              return current.filter((e) => e.id !== id);
            }
            const row = payload.new as CalendarEvent;
            const without = current.filter((e) => e.id !== row.id);
            return [...without, row];
          });
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  /** Lokale Änderung sofort anzeigen (Realtime bestätigt sie danach). */
  const upsertLocal = useCallback((row: CalendarEvent) => {
    setEvents((current) => [...current.filter((e) => e.id !== row.id), row]);
  }, []);

  const removeLocal = useCallback((id: string) => {
    setEvents((current) => current.filter((e) => e.id !== id));
  }, []);

  return { events, loading, error, upsertLocal, removeLocal };
}

export { COLUMNS as EVENT_COLUMNS };
