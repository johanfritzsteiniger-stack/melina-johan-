"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { EVENT_COLUMNS } from "@/lib/use-events";
import { RECURRENCES, type CalendarEvent, type Category, type Recurrence } from "@/lib/calendar";
import type { Person } from "@/lib/use-calendar-meta";
import { REMINDER_OPTIONS } from "@/lib/reminders";
import { notifyPartner } from "@/lib/push-client";
import { formatDate } from "@/lib/calendar";

type Props = {
  /** Bestehender Termin zum Bearbeiten, oder null für einen neuen */
  event: CalendarEvent | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: (e: CalendarEvent) => void;
  onDeleted: (id: string) => void;
  categories: Category[];
  people: Person[];
  personColor: (ownerId: string | null) => string;
};

const input =
  "w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent";

export function EventDialog({
  event,
  defaultDate,
  onClose,
  onSaved,
  onDeleted,
  categories,
  people,
  personColor,
}: Props) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [categoryId, setCategoryId] = useState<string | null>(
    event ? event.category_id : (categories[0]?.id ?? null),
  );
  // "" = keine Person, "both" = beide, sonst Profil-ID
  const [assignee, setAssignee] = useState<string>(
    event ? (event.owner_id ?? (event.shared ? "both" : "")) : "",
  );
  const [startDate, setStartDate] = useState(event?.start_date ?? defaultDate);
  const [endDate, setEndDate] = useState(event?.end_date ?? "");
  const [allDay, setAllDay] = useState(event ? !event.start_time : true);
  const [startTime, setStartTime] = useState(event?.start_time?.slice(0, 5) ?? "18:00");
  const [endTime, setEndTime] = useState(event?.end_time?.slice(0, 5) ?? "");
  const [recurrence, setRecurrence] = useState<Recurrence>(event?.recurrence ?? "none");
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [isCountdown, setIsCountdown] = useState(event?.is_countdown ?? false);
  const [reminder, setReminder] = useState<number | null>(event?.reminder_minutes ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBirthday = categories.find((c) => c.id === categoryId)?.is_birthday ?? false;

  function changeCategory(c: Category) {
    setCategoryId(c.id);
    // Vorgaben der Kategorie für neue Termine übernehmen
    if (!event) {
      if (c.is_birthday) {
        setRecurrence("yearly");
        setAllDay(true);
      }
      if (c.is_countdown) {
        setIsCountdown(true);
        setAllDay(true);
      }
    }
  }

  const owners: { value: string; label: string; color: string }[] = [
    ...people.map((p) => ({ value: p.id, label: p.display_name, color: personColor(p.id) })),
    { value: "both", label: "Beide", color: personColor(null) },
  ];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (endDate && endDate < startDate) {
      setError("Das Enddatum liegt vor dem Startdatum.");
      return;
    }
    setSaving(true);
    setError(null);

    const row = {
      title: title.trim(),
      category_id: categoryId,
      owner_id: assignee && assignee !== "both" ? assignee : null,
      shared: assignee === "both",
      start_date: startDate,
      end_date: endDate && endDate !== startDate ? endDate : null,
      start_time: allDay ? null : startTime || null,
      end_time: allDay ? null : endTime || null,
      recurrence,
      location: location.trim() || null,
      notes: notes.trim() || null,
      is_countdown: isCountdown,
      reminder_minutes: reminder,
    };

    const supabase = getSupabase();
    const query = event
      ? supabase.from("events").update(row).eq("id", event.id)
      : supabase.from("events").insert(row);
    const { data, error } = await query.select(EVENT_COLUMNS).single();

    setSaving(false);
    if (error) {
      setError("Speichern hat nicht geklappt: " + error.message);
      return;
    }
    onSaved(data as CalendarEvent);
    if (!event) {
      notifyPartner("Neuer Termin", `${row.title} · ${formatDate(row.start_date, { weekday: "short", day: "numeric", month: "short" })}`, "/kalender");
    }
    onClose();
  }

  async function remove() {
    if (!event) return;
    if (!window.confirm(`„${event.title}“ wirklich löschen?`)) return;
    const { error } = await getSupabase().from("events").delete().eq("id", event.id);
    if (error) {
      setError("Löschen hat nicht geklappt: " + error.message);
      return;
    }
    onDeleted(event.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {event ? "Termin bearbeiten" : "Neuer Termin"}
          </h2>
          <button type="button" onClick={onClose} className="p-1 text-muted" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <input
          autoFocus={!event}
          required
          placeholder="Titel"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${input} text-base font-medium`}
        />

        <div className="space-y-1">
          <span className="text-sm text-muted">Für wen? (optional)</span>
          <div className="grid grid-cols-3 gap-2">
            {owners.map((o) => {
              const active = assignee === o.value;
              const color = o.color;
              return (
                <button
                  key={o.value}
                  type="button"
                  // Nochmal tippen hebt die Auswahl wieder auf
                  onClick={() => setAssignee(active ? "" : o.value)}
                  style={active ? { borderColor: color, backgroundColor: `${color}1f` } : undefined}
                  className={`flex items-center justify-center gap-1.5 truncate rounded-lg border px-2 py-2 text-sm ${
                    active ? "font-medium text-foreground" : "border-border text-muted"
                  }`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
          {!assignee && (
            <p className="text-xs text-muted">Ohne Auswahl bekommt der Termin die Farbe der Kategorie.</p>
          )}
        </div>

        <div className="space-y-1">
          <span className="text-sm text-muted">Kategorie</span>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => changeCategory(c)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                  categoryId === c.id
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border text-muted"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-muted">
              {isBirthday ? "Geburtsdatum" : "Von"}
            </span>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={input}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-muted">Bis (optional)</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={input}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Ganztägig
        </label>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-sm text-muted">Beginn</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={input}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-muted">Ende (optional)</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={input}
              />
            </label>
          </div>
        )}

        <label className="block space-y-1">
          <span className="text-sm text-muted">Wiederholung</span>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            className={input}
          >
            {(Object.keys(RECURRENCES) as Recurrence[]).map((r) => (
              <option key={r} value={r}>
                {RECURRENCES[r]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-muted">Erinnerung per Push</span>
          <select
            value={reminder === null ? "" : String(reminder)}
            onChange={(e) => setReminder(e.target.value === "" ? null : Number(e.target.value))}
            className={input}
          >
            {REMINDER_OPTIONS.map((o) => (
              <option key={o.label} value={o.value === null ? "" : String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
          {allDay && reminder !== null && (
            <span className="block text-xs text-muted">Bei ganztägigen Terminen gilt 9:00 Uhr als Beginn.</span>
          )}
        </label>

        <input
          placeholder="Ort (optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={input}
        />

        <textarea
          placeholder="Notiz (optional)"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={input}
        />

        <label className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm">
          <input
            type="checkbox"
            checked={isCountdown}
            onChange={(e) => setIsCountdown(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Als Countdown auf der Startseite zeigen
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          {event && (
            <button
              type="button"
              onClick={remove}
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10"
            >
              Löschen
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-foreground/5"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {saving ? "Speichern …" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
