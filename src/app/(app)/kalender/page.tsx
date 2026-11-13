"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Plus, Repeat, Timer } from "lucide-react";
import { EventDialog } from "@/components/event-dialog";
import { PageHeader } from "@/components/page-header";
import { SkeletonList } from "@/components/skeleton";
import { getSupabase } from "@/lib/supabase/client";
import { useEvents } from "@/lib/use-events";
import { useToday } from "@/lib/use-today";
import { useCalendarMeta } from "@/lib/use-calendar-meta";
import { useLocalSetting } from "@/lib/local-setting";
import { chipStyle } from "@/lib/colors";
import { toast, toastError } from "@/lib/toast";
import {
  WEEKDAYS,
  addDays,
  ageAt,
  diffDays,
  expand,
  formatDate,
  formatRange,
  formatTime,
  fromISO,
  monthGrid,
  relativeLabel,
  shiftDates,
  startOfWeek,
  type CalendarEvent,
  type Occurrence,
} from "@/lib/calendar";

type DialogState = { event: CalendarEvent | null; date: string } | null;
type View = "monat" | "woche" | "agenda";
const VIEWS = ["monat", "woche", "agenda"] as const;
type Meta = ReturnType<typeof useCalendarMeta>;

/** Vorkommen nach Tag gruppieren (mehrtägige Termine an jedem Tag). */
function groupByDay(occurrences: Occurrence[], from: string, to: string) {
  const map = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    for (let d = o.start; d <= o.end; d = addDays(d, 1)) {
      if (d < from || d > to) continue;
      map.set(d, [...(map.get(d) ?? []), o]);
    }
  }
  return map;
}

export default function KalenderPage() {
  const today = useToday();
  const { events, loading, error, upsertLocal, removeLocal } = useEvents();
  const meta = useCalendarMeta();
  const [view, setView] = useLocalSetting<View>("kalender-ansicht", "monat", VIEWS);

  // Anker: ein Datum im angezeigten Monat bzw. in der angezeigten Woche
  const [anchor, setAnchor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [direction, setDirection] = useState<"next" | "prev" | null>(null);
  const [agendaDays, setAgendaDays] = useState(60);

  const current = anchor ?? today;
  const selectedDay = selected ?? today;

  // Sichtbarer Zeitraum
  const range = useMemo(() => {
    if (!current) return null;
    if (view === "monat") {
      const d = fromISO(current);
      const grid = monthGrid(d.getFullYear(), d.getMonth());
      return { from: grid[0], to: grid[grid.length - 1], grid, month: d.getMonth() };
    }
    if (view === "woche") {
      const from = startOfWeek(current);
      const grid = Array.from({ length: 7 }, (_, i) => addDays(from, i));
      return { from, to: grid[6], grid, month: -1 };
    }
    return { from: today, to: addDays(today, agendaDays), grid: [] as string[], month: -1 };
  }, [current, view, today, agendaDays]);

  const byDay = useMemo(
    () => (range ? groupByDay(expand(events, range.from, range.to), range.from, range.to) : new Map<string, Occurrence[]>()),
    [events, range],
  );

  const upcoming = useMemo(
    () => (today ? expand(events, today, addDays(today, 60)).slice(0, 8) : []),
    [events, today],
  );

  if (!today || !range || !current) return <PageHeader title="Kalender" />;

  function shift(delta: number) {
    setDirection(delta > 0 ? "next" : "prev");
    if (view === "monat") {
      const d = fromISO(current!);
      const next = new Date(d.getFullYear(), d.getMonth() + delta, 1);
      setAnchor(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`);
    } else {
      setAnchor(addDays(startOfWeek(current!), delta * 7));
    }
  }

  function goToday() {
    setDirection(null);
    setAnchor(null);
    setSelected(null);
  }

  /** Termin per Drag & Drop um die Differenz zwischen zwei Tagen verschieben. */
  async function moveEvent(eventId: string, fromDay: string, toDay: string) {
    const event = events.find((e) => e.id === eventId);
    const days = diffDays(fromDay, toDay);
    if (!event || days === 0) return;
    const before = { start_date: event.start_date, end_date: event.end_date };
    const after = shiftDates(event, days);
    upsertLocal({ ...event, ...after });
    const { error } = await getSupabase().from("events").update(after).eq("id", event.id);
    if (error) {
      upsertLocal(event);
      return toastError("Verschieben hat nicht geklappt: " + error.message);
    }
    toast(`„${event.title}“ → ${formatDate(toDay, { weekday: "short", day: "numeric", month: "short" })}`, {
      label: "Rückgängig",
      run: async () => {
        upsertLocal({ ...event, ...before });
        await getSupabase().from("events").update(before).eq("id", event.id);
      },
    });
  }

  let title = "Die nächsten Wochen";
  let subtitle = "";
  if (view === "monat") {
    title = fromISO(current).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  } else if (view === "woche") {
    const from = startOfWeek(current);
    const thursday = addDays(from, 3);
    title = `KW ${Math.floor(diffDays(`${thursday.slice(0, 4)}-01-01`, thursday) / 7) + 1}`;
    subtitle = `${formatDate(from, { day: "numeric", month: "short" })} – ${formatDate(addDays(from, 6), { day: "numeric", month: "short" })}`;
  }

  const slideClass = direction === "next" ? "slide-next" : direction === "prev" ? "slide-prev" : "";
  const openNew = (date: string) => setDialog({ event: null, date });
  const openEvent = (e: CalendarEvent, date: string) => setDialog({ event: e, date });

  return (
    <>
      <PageHeader
        title="Kalender"
        action={
          <button
            onClick={() => openNew(selectedDay)}
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

      {/* Ansicht wählen */}
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-foreground/5 p-1 text-sm sm:inline-grid sm:w-auto">
        {VIEWS.map((v) => (
          <button
            key={v}
            onClick={() => {
              setView(v);
              setDirection(null);
            }}
            className={`rounded-md px-4 py-1.5 ${view === v ? "bg-card font-medium shadow-sm" : "text-muted"}`}
          >
            {v === "monat" ? "Monat" : v === "woche" ? "Woche" : "Agenda"}
          </button>
        ))}
      </div>

      <div className={view === "monat" ? "grid gap-6 xl:grid-cols-[1fr_280px]" : ""}>
        <section className="rounded-2xl border border-border bg-card p-3 sm:p-4">
          {/* Navigation */}
          <div className="mb-3 flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">
              {title}
              {subtitle && <span className="ml-2 text-sm font-normal text-muted">{subtitle}</span>}
            </h2>
            {view !== "agenda" && (
              <>
                <button onClick={goToday} className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-foreground/5">
                  Heute
                </button>
                <button onClick={() => shift(-1)} className="rounded-lg p-1.5 hover:bg-foreground/5" aria-label="Zurück">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={() => shift(1)} className="rounded-lg p-1.5 hover:bg-foreground/5" aria-label="Weiter">
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {view === "agenda" ? (
            <AgendaView
              byDay={byDay}
              from={range.from}
              to={range.to}
              today={today}
              meta={meta}
              loading={loading && events.length === 0}
              onOpen={openEvent}
              onMore={() => setAgendaDays((d) => d + 90)}
            />
          ) : (
            <Swipeable onSwipe={shift}>
              <div key={`${view}-${range.from}`} className={slideClass}>
                {view === "monat" ? (
                  <MonthGrid
                    grid={range.grid}
                    month={range.month}
                    byDay={byDay}
                    today={today}
                    selectedDay={selectedDay}
                    meta={meta}
                    onSelect={setSelected}
                    onNew={openNew}
                    onOpen={openEvent}
                    onMove={moveEvent}
                  />
                ) : (
                  <WeekView
                    days={range.grid}
                    byDay={byDay}
                    today={today}
                    meta={meta}
                    onNew={openNew}
                    onOpen={openEvent}
                    onMove={moveEvent}
                  />
                )}
              </div>
            </Swipeable>
          )}

          {view !== "agenda" && (
            <p className="mt-2 text-xs text-muted">
              <span className="sm:hidden">Tipp: wischen zum Blättern.</span>
              <span className="hidden sm:inline">
                Tipp: Doppelklick legt einen Termin an, Termine lassen sich per Drag &amp; Drop verschieben.
              </span>
            </p>
          )}
        </section>

        {view === "monat" && (
          <aside className="space-y-6">
            <section>
              <h3 className="mb-2 text-sm font-medium">
                {formatDate(selectedDay, { weekday: "long", day: "numeric", month: "long" })}
              </h3>
              {(byDay.get(selectedDay) ?? []).length === 0 ? (
                <button
                  onClick={() => openNew(selectedDay)}
                  className="w-full rounded-xl border border-dashed border-border p-4 text-sm text-muted hover:border-accent/50"
                >
                  Nichts geplant – Termin hinzufügen
                </button>
              ) : (
                <EntryList entries={byDay.get(selectedDay) ?? []} today={today} meta={meta} onOpen={(e) => openEvent(e, selectedDay)} />
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-medium">Demnächst</h3>
              {loading && events.length === 0 ? (
                <SkeletonList />
              ) : upcoming.length === 0 ? (
                <p className="text-sm text-muted">In den nächsten 60 Tagen steht nichts an.</p>
              ) : (
                <EntryList entries={upcoming} today={today} meta={meta} showRelative onOpen={(e) => openEvent(e, e.start_date)} />
              )}
            </section>
          </aside>
        )}
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

// ---------- Wischen ----------

function Swipeable({ onSwipe, children }: { onSwipe: (delta: number) => void; children: React.ReactNode }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      onTouchStart={(e) => {
        const t = e.touches[0];
        start.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
      }}
    >
      {children}
    </div>
  );
}

// ---------- Drag & Drop (PC) ----------

const DRAG_TYPE = "application/x-termin";

function dragProps(o: Occurrence, day: string) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ id: o.event.id, from: day }));
      e.dataTransfer.effectAllowed = "move";
    },
  };
}

function useDropTarget(day: string, onMove: (id: string, from: string, to: string) => void) {
  const [over, setOver] = useState(false);
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        try {
          const { id, from } = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as { id: string; from: string };
          onMove(id, from, day);
        } catch {
          // kein Termin
        }
      },
    },
  };
}

// ---------- Monatsansicht ----------

function MonthGrid({
  grid,
  month,
  byDay,
  today,
  selectedDay,
  meta,
  onSelect,
  onNew,
  onOpen,
  onMove,
}: {
  grid: string[];
  month: number;
  byDay: Map<string, Occurrence[]>;
  today: string;
  selectedDay: string;
  meta: Meta;
  onSelect: (d: string) => void;
  onNew: (d: string) => void;
  onOpen: (e: CalendarEvent, d: string) => void;
  onMove: (id: string, from: string, to: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-7 text-center text-xs text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {grid.map((day) => (
          <MonthCell
            key={day}
            day={day}
            inMonth={fromISO(day).getMonth() === month}
            entries={byDay.get(day) ?? []}
            isToday={day === today}
            isSelected={day === selectedDay}
            meta={meta}
            onSelect={onSelect}
            onNew={onNew}
            onOpen={onOpen}
            onMove={onMove}
          />
        ))}
      </div>
    </>
  );
}

function MonthCell({
  day,
  inMonth,
  entries,
  isToday,
  isSelected,
  meta,
  onSelect,
  onNew,
  onOpen,
  onMove,
}: {
  day: string;
  inMonth: boolean;
  entries: Occurrence[];
  isToday: boolean;
  isSelected: boolean;
  meta: Meta;
  onSelect: (d: string) => void;
  onNew: (d: string) => void;
  onOpen: (e: CalendarEvent, d: string) => void;
  onMove: (id: string, from: string, to: string) => void;
}) {
  const drop = useDropTarget(day, onMove);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(day)}
      onDoubleClick={() => onNew(day)}
      {...drop.props}
      className={`flex min-h-14 cursor-pointer flex-col items-stretch gap-1 bg-card p-1 text-left sm:min-h-24 sm:p-1.5 ${
        inMonth ? "" : "bg-background text-muted/60"
      } ${isSelected ? "ring-2 ring-accent ring-inset" : ""} ${drop.over ? "bg-accent/10" : ""}`}
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
          <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.colorOf(o.event) }} />
        ))}
      </span>

      {/* PC: Titel, ziehbar */}
      <span className="hidden flex-col gap-0.5 sm:flex">
        {entries.slice(0, 3).map((o, i) => (
          <span
            key={i}
            role="button"
            {...dragProps(o, day)}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(o.event, day);
            }}
            style={chipStyle(meta.colorOf(o.event))}
            className="cursor-grab truncate rounded px-1 py-0.5 text-[11px] leading-tight text-foreground active:cursor-grabbing"
          >
            {o.event.start_time && day === o.start ? `${formatTime(o.event.start_time)} ` : ""}
            {o.event.title}
          </span>
        ))}
        {entries.length > 3 && <span className="px-1 text-[11px] text-muted">+{entries.length - 3} weitere</span>}
      </span>
    </div>
  );
}

// ---------- Wochenansicht ----------

function WeekView({
  days,
  byDay,
  today,
  meta,
  onNew,
  onOpen,
  onMove,
}: {
  days: string[];
  byDay: Map<string, Occurrence[]>;
  today: string;
  meta: Meta;
  onNew: (d: string) => void;
  onOpen: (e: CalendarEvent, d: string) => void;
  onMove: (id: string, from: string, to: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7 sm:gap-px sm:overflow-hidden sm:rounded-lg sm:border sm:border-border sm:bg-border">
      {days.map((day) => (
        <WeekDay
          key={day}
          day={day}
          entries={byDay.get(day) ?? []}
          isToday={day === today}
          meta={meta}
          onNew={onNew}
          onOpen={onOpen}
          onMove={onMove}
        />
      ))}
    </div>
  );
}

function WeekDay({
  day,
  entries,
  isToday,
  meta,
  onNew,
  onOpen,
  onMove,
}: {
  day: string;
  entries: Occurrence[];
  isToday: boolean;
  meta: Meta;
  onNew: (d: string) => void;
  onOpen: (e: CalendarEvent, d: string) => void;
  onMove: (id: string, from: string, to: string) => void;
}) {
  const drop = useDropTarget(day, onMove);
  // Ganztägige zuerst, dann nach Uhrzeit
  const sorted = [...entries].sort((a, b) =>
    (a.event.start_time ?? "").localeCompare(b.event.start_time ?? ""),
  );
  return (
    <div
      {...drop.props}
      onDoubleClick={() => onNew(day)}
      className={`flex flex-col gap-1.5 rounded-xl border border-border bg-card p-2 sm:min-h-64 sm:rounded-none sm:border-0 ${
        drop.over ? "bg-accent/10" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className={`text-sm ${isToday ? "font-semibold text-accent" : "text-muted"}`}>
          {formatDate(day, { weekday: "short" })}{" "}
          <span
            className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 ${
              isToday ? "bg-accent text-accent-foreground" : "text-foreground"
            }`}
          >
            {fromISO(day).getDate()}
          </span>
        </span>
        <button
          onClick={() => onNew(day)}
          className="rounded p-1 text-muted hover:bg-foreground/5 hover:text-foreground"
          aria-label="Termin an diesem Tag"
        >
          <Plus size={14} />
        </button>
      </div>
      {sorted.length === 0 && <span className="text-xs text-muted/60 sm:hidden">–</span>}
      {sorted.map((o) => (
        <button
          key={`${o.event.id}-${o.start}`}
          {...dragProps(o, day)}
          onClick={() => onOpen(o.event, day)}
          style={chipStyle(meta.colorOf(o.event))}
          className="cursor-grab rounded-md px-2 py-1 text-left text-sm leading-tight text-foreground active:cursor-grabbing sm:text-xs"
        >
          {o.event.start_time && day === o.start && (
            <span className="block text-xs text-muted">{formatTime(o.event.start_time)}</span>
          )}
          <span className="line-clamp-2">{o.event.title}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Agenda ----------

function AgendaView({
  byDay,
  from,
  to,
  today,
  meta,
  loading,
  onOpen,
  onMore,
}: {
  byDay: Map<string, Occurrence[]>;
  from: string;
  to: string;
  today: string;
  meta: Meta;
  loading: boolean;
  onOpen: (e: CalendarEvent, d: string) => void;
  onMore: () => void;
}) {
  if (loading) return <SkeletonList rows={4} />;
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (byDay.has(d)) days.push(d);

  const dayLabel = (d: string) => {
    const diff = diffDays(today, d);
    const date = formatDate(d, { weekday: "long", day: "numeric", month: "long" });
    return diff === 0 ? `Heute · ${date}` : diff === 1 ? `Morgen · ${date}` : date;
  };

  return (
    <div className="space-y-5">
      {days.length === 0 && <p className="text-sm text-muted">In diesem Zeitraum steht nichts an.</p>}
      {days.map((d) => (
        <div key={d}>
          <h3 className={`mb-2 text-sm font-medium ${d === today ? "text-accent" : ""}`}>{dayLabel(d)}</h3>
          <EntryList entries={byDay.get(d) ?? []} today={today} meta={meta} onOpen={(e) => onOpen(e, d)} />
        </div>
      ))}
      <button onClick={onMore} className="w-full rounded-xl border border-border py-2 text-sm text-muted hover:bg-foreground/5">
        Weitere 3 Monate anzeigen (bis {formatDate(addDays(to, 90), { day: "numeric", month: "short", year: "numeric" })})
      </button>
    </div>
  );
}

// ---------- Liste ----------

function EntryList({
  entries,
  today,
  meta,
  showRelative,
  onOpen,
}: {
  entries: Occurrence[];
  today: string;
  meta: Meta;
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
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.colorOf(o.event) }} />
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
              {showRelative && <span className="shrink-0 text-xs text-muted">{relativeLabel(o, today)}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
