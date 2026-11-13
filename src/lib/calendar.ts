// Kalender-Logik: Datums-Helfer und Wiederholungen.
// Daten werden als "YYYY-MM-DD"-Strings gespeichert, um Zeitzonen-Probleme zu vermeiden.

export type Category = "termin" | "urlaub" | "feier" | "geburtstag" | "sonstiges";
export type Recurrence = "none" | "weekly" | "monthly" | "yearly";

export type CalendarEvent = {
  id: string;
  title: string;
  category: Category;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  recurrence: Recurrence;
  location: string | null;
  notes: string | null;
  is_countdown: boolean;
  created_by: string | null;
};

/** Ein konkretes Vorkommen eines (evtl. wiederkehrenden) Termins. */
export type Occurrence = {
  event: CalendarEvent;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (gleich start bei eintägigen Terminen)
};

export const CATEGORIES: Record<
  Category,
  { label: string; dot: string; chip: string }
> = {
  termin: {
    label: "Termin",
    dot: "bg-sky-500",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  urlaub: {
    label: "Urlaub",
    dot: "bg-teal-500",
    chip: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  },
  feier: {
    label: "Feier",
    dot: "bg-amber-500",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  geburtstag: {
    label: "Geburtstag",
    dot: "bg-rose-500",
    chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
  sonstiges: {
    label: "Sonstiges",
    dot: "bg-zinc-400",
    chip: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
  },
};

export const RECURRENCES: Record<Recurrence, string> = {
  none: "Keine",
  weekly: "Jede Woche",
  monthly: "Jeden Monat",
  yearly: "Jedes Jahr",
};

// ---------- Datums-Helfer ----------

const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Tage zwischen zwei Daten (b - a), unabhängig von Sommerzeit. */
export function diffDays(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000,
  );
}

function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Datum mit Jahr/Monat-Versatz; Tag wird bei kurzen Monaten gekappt (z. B. 29.02. → 28.02.). */
function shiftMonths(iso: string, months: number, clamp: boolean): string | null {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const max = daysInMonth(ny, nm);
  if (d > max && !clamp) return null;
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, max))}`;
}

// ---------- Wiederholungen ----------

/** Alle Vorkommen eines Termins, die den Zeitraum [from, to] berühren. */
export function occurrencesInRange(
  event: CalendarEvent,
  from: string,
  to: string,
): Occurrence[] {
  const length = event.end_date ? diffDays(event.start_date, event.end_date) : 0;
  const result: Occurrence[] = [];
  const push = (start: string) => {
    const end = addDays(start, length);
    if (end >= from && start <= to) result.push({ event, start, end });
  };

  if (event.recurrence === "none") {
    push(event.start_date);
    return result;
  }

  // Erstes relevantes Vorkommen grob bestimmen, dann iterieren
  const earliest = addDays(from, -length);
  if (event.recurrence === "weekly") {
    let start = event.start_date;
    if (start < earliest) {
      const weeks = Math.floor(diffDays(start, earliest) / 7);
      start = addDays(start, weeks * 7);
    }
    for (; start <= to; start = addDays(start, 7)) {
      if (start >= event.start_date) push(start);
    }
    return result;
  }

  const step = event.recurrence === "monthly" ? 1 : 12;
  const clamp = event.recurrence === "yearly"; // Geburtstag am 29.02. → 28.02.
  let i = 0;
  if (event.start_date < earliest) {
    const [y1, m1] = event.start_date.split("-").map(Number);
    const [y2, m2] = earliest.split("-").map(Number);
    const monthsBetween = (y2 - y1) * 12 + (m2 - m1);
    i = Math.max(0, Math.floor(monthsBetween / step) - 1);
  }
  for (let guard = 0; guard < 500; guard++, i++) {
    const start = shiftMonths(event.start_date, i * step, clamp);
    if (start === null) continue;
    if (start > to) break;
    push(start);
  }
  return result;
}

/** Alle Vorkommen aller Termine im Zeitraum, sortiert nach Datum und Uhrzeit. */
export function expand(
  events: CalendarEvent[],
  from: string,
  to: string,
): Occurrence[] {
  return events
    .flatMap((e) => occurrencesInRange(e, from, to))
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        (a.event.start_time ?? "").localeCompare(b.event.start_time ?? "") ||
        a.event.title.localeCompare(b.event.title),
    );
}

/** Nächstes Vorkommen ab heute (laufende mehrtägige Termine zählen mit). */
export function nextOccurrence(
  event: CalendarEvent,
  today: string,
): Occurrence | null {
  const horizon = addDays(today, 366 * 2);
  return occurrencesInRange(event, today, horizon)[0] ?? null;
}

// ---------- Anzeige ----------

export function formatTime(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

export function formatDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" },
): string {
  return fromISO(iso).toLocaleDateString("de-DE", opts);
}

export function formatRange(o: Occurrence): string {
  const e = o.event;
  const time = e.start_time
    ? `${formatTime(e.start_time)}${e.end_time ? `–${formatTime(e.end_time)}` : ""} Uhr`
    : "";
  if (o.start === o.end) {
    return [formatDate(o.start, { weekday: "short", day: "numeric", month: "short" }), time]
      .filter(Boolean)
      .join(", ");
  }
  return `${formatDate(o.start)} – ${formatDate(o.end, { day: "numeric", month: "short", year: "numeric" })}`;
}

/** "heute", "morgen", "in 12 Tagen" bzw. "läuft gerade". */
export function relativeLabel(o: Occurrence, today: string): string {
  if (o.start <= today && o.end >= today) {
    return o.start === o.end ? "heute" : "läuft gerade";
  }
  const days = diffDays(today, o.start);
  if (days === 1) return "morgen";
  return `in ${days} Tagen`;
}

/** Alter beim nächsten Geburtstag (wenn das Startdatum das Geburtsdatum ist). */
export function ageAt(event: CalendarEvent, occurrenceStart: string): number | null {
  if (event.category !== "geburtstag" || event.recurrence !== "yearly") return null;
  const age = Number(occurrenceStart.slice(0, 4)) - Number(event.start_date.slice(0, 4));
  return age > 0 ? age : null;
}

/** Tage eines Monatsrasters (Montag bis Sonntag, 6 Wochen). */
export function monthGrid(year: number, month0: number): string[] {
  const first = new Date(year, month0, 1);
  const offset = (first.getDay() + 6) % 7; // Montag = 0
  const start = toISO(new Date(year, month0, 1 - offset));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
