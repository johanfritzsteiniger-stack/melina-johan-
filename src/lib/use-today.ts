"use client";

import { useSyncExternalStore } from "react";
import { todayISO } from "@/lib/calendar";

const subscribe = (onChange: () => void) => {
  // Um Mitternacht bzw. beim Zurückkehren in die App aktualisieren
  const id = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onChange);
  };
};

/** Heutiges Datum (YYYY-MM-DD), erst im Browser bekannt; beim Vorrendern "". */
export function useToday(): string {
  return useSyncExternalStore(subscribe, todayISO, () => "");
}
