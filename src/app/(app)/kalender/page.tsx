"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Plus, Repeat, Timer } from "lucide-react";
import { EventDialog } from "@/components/event-dialog";
import { PageHeader } from "@/components/page-header";
import { useEvents } from "@/lib/use-events";
import { useToday } from "@/lib/use-today";
import { useCalendarMeta } from "@/lib/use-calendar-meta";
import { chipStyle } from "@/lib/colors";
import {
  WEEKDAYS,
  addDays,
  ageAt,
  expand,
  formatDate,
  formatRange,
  formatTime,
  fromISO,
  monthGrid,
  relativeLabel,
  type CalendarEvent,
  type Occurrence,
} from "@/lib/calendar";

type DialogState = { event: CalendarEvent | null; date: string } | null;

export default function KalenderPage() {
  const today = useToday();
  const { events, loading, error, upsertLocal, removeLocal } = useEvents();
  const meta = useCalendarMeta();

  const [month, setMonth] = useState<{ y: number; m: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);

  // Bis "heute" im Browser bekannt ist, nichts rendern
  const base = today ? fromISO(today) : null;
  const view = month ?? (base ? { y: base.getFullYear(), m: base.getMonth() } : null);
  const selectedDay = selected ?? today;

  const vy = view?.y;
  const vm = view?.m;
  const grid = useMemo(
    () => (vy !== undefined && vm !== undefined ? monthGrid(vy, vm) : []),
    [vy, vm],
  );
  const occurrences = useMemo(
    () => (grid.length ? expand(events, grid[0], grid[grid.length - 1]) : []),
    [events, grid],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const o of occurrences) {
      for (let d = o.start; d <= o.end; d = addDays(d, 1)) {
        if (d < grid[0] || d > grid[grid.length - 1]) continue;
        map.set(d, [...(map.get(d) ?? []), o]);
      }
    }
    return map;
  }, [occurrences, grid]);

  const upcoming = useMemo(
    () => (today ? expand(events, today, addDays(today, 60)).slice(0, 8) : []),
    [events, today],
  );

  if (!view || !today) return <PageHeader title="Kalender" />;

  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });

  function shift(delta: number) {
    const d = new Date(view!.y, view!.m + delta, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  }

  function goToday() {
    setMonth(null);
    setSelected(null);
  }

  const dayEntries = byDay.get(selectedDay) ?? [];

  return (
    <>
      <PageHeader
        title="Kalender"
        action={
          <button
            onClick={() => setDialog({ event: null, date: selectedDay })}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Termin</span>
          </button>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        {/* Monatsansicht */}
        <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="flex-1 text-lg font-semibold capitalize">{monthLabel}</h2>
            <button onClick={goToday} className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-foreground/5">
              Heute
            </button>
            <button onClick={() => shift(-1)} className="rounded-lg p-1.5 hover:bg-foreground/5" aria-label="Voriger Monat">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => shift(1)} className="rounded-lg p-1.5 hover:bg-foreground/5" aria-label="Nächster Monat">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-xs text-muted">
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
            {grid.map((day) => {
              const inMonth = fromISO(day).getMonth() === view.m;
              const entries = byDay.get(day) ?? [];
              const isToday = day === today;
              const isSelected = day === selectedDay;
              return (
                <button
                  key={day}
                  onClick={() => setSelected(day)}
                  onDoubleClick={() => setDialog({ event: null, date: day })}
                  className={`flex min-h-14 flex-col items-stretch gap-1 bg-card p-1 text-left sm:min-h-24 sm:p-1.5 ${
                    inMonth ? "" : "bg-background text-muted/60"
                  } ${isSelected ? "ring-2 ring-inset ring-accent" : ""}`}
                >
                  <span
                    className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs sm:mx-0 ${
                      isToday ? "bg-accent font-semibold text-accent-foreground" : ""
                    }`}
                  >
                    {fromISO(day).getDate()}
                  </span>

                  {/* Handy: Punkte */}
                  <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                    {entries.slice(0, 4).map((o, i) => (
                      <span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: meta.colorOf(o.event) }}
                      />
                    ))}
                  </span>

                  {/* PC: Titel */}
                  <span className="hidden flex-col gap-0.5 sm:flex">
                    {entries.slice(0, 3).map((o, i) => (
                      <span
                        key={i}
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDialog({ event: o.event, date: day });
                        }}
                        style={chipStyle(meta.colorOf(o.event))}
                        className="truncate rounded px-1 py-0.5 text-[11px] leading-tight text-foreground"
                      >
                        {o.event.start_time && day === o.start ? `${formatTime(o.event.start_time)} ` : ""}
                        {o.event.title}
                      </span>
                    ))}
                    {entries.length > 3 && (
                      <span className="px-1 text-[11px] text-muted">+{entries.length - 3} weitere</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 hidden text-xs text-muted sm:block">Tipp: Doppelklick auf einen Tag legt dort einen Termin an.</p>
        </section>

        {/* Seitenleiste: gewählter Tag + Demnächst */}
        <aside className="space-y-6">
          <section>
            <h3 className="mb-2 text-sm font-medium">
              {formatDate(selectedDay, { weekday: "long", day: "numeric", month: "long" })}
            </h3>
            {dayEntries.length === 0 ? (
              <button
                onClick={() => setDialog({ event: null, date: selectedDay })}
                className="w-full rounded-xl border border-dashed border-border p-4 text-sm text-muted hover:border-accent/50"
              >
                Nichts geplant – Termin hinzufügen
              </button>
            ) : (
              <EntryList entries={dayEntries} today={today} meta={meta} onOpen={(e) => setDialog({ event: e, date: selectedDay })} />
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium">Demnächst</h3>
            {loading && events.length === 0 ? (
              <p className="text-sm text-muted">Lädt …</p>
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-muted">In den nächsten 60 Tagen steht nichts an.</p>
            ) : (
              <EntryList entries={upcoming} today={today} meta={meta} showRelative onOpen={(e) => setDialog({ event: e, date: e.start_date })} />
            )}
          </section>
        </aside>
      </div>

      {dialog && (
        <EventDialog
          event={dialog.event}
          defaultDate={dialog.date}
          onClose={() => setDialog(null)}
          onSaved={upsertLocal}
          onDeleted={removeLocal}
          categories={meta.categories}
          people={meta.people}
          personColor={meta.personColor}
        />
      )}
    </>
  );
}

function EntryList({
  entries,
  today,
  meta,
  showRelative,
  onOpen,
}: {
  entries: Occurrence[];
  today: string;
  meta: ReturnType<typeof useCalendarMeta>;
  showRelative?: boolean;
  onOpen: (e: CalendarEvent) => void;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {entries.map((o) => {
        const category = meta.categoryOf(o.event);
        const age = ageAt(o.event, o.start, category);
        return (
          <li key={`${o.event.id}-${o.start}`}>
            <button onClick={() => onOpen(o.event)} className="flex w-full gap-3 p-3 text-left hover:bg-foreground/5">
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: meta.colorOf(o.event) }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="truncate">
                    {o.event.title}
                    {age ? ` (${age})` : ""}
                  </span>
                  {o.event.recurrence !== "none" && <Repeat size={13} className="shrink-0 text-muted" />}
                  {o.event.is_countdown && <Timer size={13} className="shrink-0 text-muted" />}
                </span>
                <span className="block text-xs text-muted">{formatRange(o)}</span>
                <span className="block text-xs text-muted">
                  {[meta.ownerLabel(o.event), category?.name].filter(Boolean).join(" · ")}
                </span>
                {o.event.location && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <MapPin size={12} />
                    {o.event.location}
                  </span>
                )}
              </span>
              {showRelative && (
                <span className="shrink-0 text-xs text-muted">{relativeLabel(o, today)}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
