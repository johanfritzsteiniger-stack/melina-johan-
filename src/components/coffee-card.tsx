"use client";

import { useState } from "react";
import { Coffee } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { useCoffeeYear } from "@/lib/use-coffee";
import { diffDays } from "@/lib/calendar";
import { toast, toastError } from "@/lib/toast";
import { playCoffeeSound, preloadCoffeeSound } from "@/lib/coffee-sound";
import type { Person } from "@/lib/use-calendar-meta";

/** Kaffee-Zähler auf der Startseite: antippen → bestätigen → gezählt. */
export function CoffeeCard({
  today,
  meId,
  people,
  personColor,
}: {
  today: string;
  meId: string | null;
  people: Person[];
  personColor: (id: string | null) => string;
}) {
  const year = today ? Number(today.slice(0, 4)) : null;
  const { days, setDays, error } = useCoffeeYear(year);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  const total = (id: string) => days.filter((d) => d.user_id === id).reduce((s, d) => s + d.cups, 0);
  const todayOf = (id: string) => days.find((d) => d.user_id === id && d.day === today)?.cups ?? 0;
  const dayOfYear = today && year ? diffDays(`${year}-01-01`, today) + 1 : 1;

  function bump(delta: number) {
    if (!meId) return;
    setDays((rows) => {
      const hit = rows.find((d) => d.user_id === meId && d.day === today);
      if (hit) return rows.map((d) => (d === hit ? { ...d, cups: Math.max(0, d.cups + delta) } : d));
      return delta > 0 ? [...rows, { user_id: meId, day: today, cups: delta }] : rows;
    });
  }

  async function confirm() {
    if (busy || !meId) return;
    playCoffeeSound(); // direkt im Klick, sonst blockt iOS den Ton
    setBusy(true);
    const id = crypto.randomUUID();
    bump(1); // sofort anzeigen
    setAsking(false);
    const { error } = await getSupabase().from("coffees").insert({ id, user_id: meId });
    setBusy(false);
    if (error) {
      bump(-1);
      return toastError("Speichern hat nicht geklappt: " + error.message);
    }
    toast(`☕ Gezählt – heute dein ${todayOf(meId) + 1}.`, {
      label: "Rückgängig",
      run: async () => {
        bump(-1);
        const { error: e } = await getSupabase().from("coffees").delete().eq("id", id);
        if (e) toastError("Rückgängig hat nicht geklappt: " + e.message);
      },
    });
  }

  // Ich zuerst
  const ordered = [...people].sort((a, b) => (a.id === meId ? -1 : b.id === meId ? 1 : 0));

  return (
    <>
      <button
        type="button"
        onClick={() => {
          preloadCoffeeSound();
          setAsking(true);
        }}
        disabled={!today || !meId || !!error}
        className="mb-6 w-full rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:border-accent/50 active:scale-[0.99] disabled:opacity-100"
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Coffee size={18} className="text-accent" />
          Kaffee {year ?? ""}
          <span className="ml-auto rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            + Tasse
          </span>
        </div>
        {error ? (
          <p className="text-sm text-muted">{error}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {ordered.map((p) => {
              const t = total(p.id);
              return (
                <div key={p.id} className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: personColor(p.id) }} />
                    {p.id === meId ? "Du" : p.display_name}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">{t.toLocaleString("de-DE")}</p>
                  <p className="text-xs text-muted tabular-nums">
                    heute {todayOf(p.id)} · Ø {(t / dayOfYear).toLocaleString("de-DE", { maximumFractionDigits: 1 })}/Tag
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </button>

      {asking && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onClick={() => setAsking(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="pb-safe sheet-in w-full max-w-sm rounded-t-2xl bg-card p-6 text-center shadow-xl sm:rounded-2xl"
          >
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Coffee size={28} />
            </div>
            <h2 className="text-lg font-semibold">Hattest du einen Kaffee?</h2>
            <p className="mt-1 text-sm text-muted">
              Heute wäre es dein {meId ? todayOf(meId) + 1 : 1}. – dieses Jahr insgesamt{" "}
              {meId ? total(meId) + 1 : 1}.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAsking(false)}
                className="rounded-xl border border-border py-3 text-sm font-medium text-muted hover:bg-foreground/5"
              >
                Abbrechen
              </button>
              <button
                type="button"
                autoFocus
                onClick={confirm}
                className="rounded-xl bg-accent py-3 text-sm font-semibold text-accent-foreground"
              >
                Ja ☕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
