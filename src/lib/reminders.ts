// Berechnet fällige Termin-Erinnerungen und die Tagesübersicht (rein, ohne Datenbank).
import { addDays, expand, formatTime, type CalendarEvent, type Occurrence } from "@/lib/calendar";
import { berlinToUtc } from "@/lib/tz";

/** Ganztägige Termine erinnern relativ zu dieser Uhrzeit. */
export const ALL_DAY_BASE = "09:00";

export const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Keine" },
  { value: 0, label: "Zum Beginn" },
  { value: 15, label: "15 Min vorher" },
  { value: 30, label: "30 Min vorher" },
  { value: 60, label: "1 Std vorher" },
  { value: 120, label: "2 Std vorher" },
  { value: 1440, label: "1 Tag vorher" },
  { value: 2880, label: "2 Tage vorher" },
  { value: 10080, label: "1 Woche vorher" },
];

export type DueReminder = { occurrence: Occurrence; fireAt: Date; key: string };

/** Erinnerungen, deren Zeitpunkt im Fenster (now - windowMinutes, now] liegt. */
export function dueReminders(
  events: CalendarEvent[],
  now: Date,
  today: string,
  windowMinutes = 30,
): DueReminder[] {
  const withReminder = events.filter((e) => e.reminder_minutes !== null && e.reminder_minutes !== undefined);
  const occurrences = expand(withReminder, addDays(today, -1), addDays(today, 8));
  const from = now.getTime() - windowMinutes * 60_000;
  const result: DueReminder[] = [];
  for (const o of occurrences) {
    const start = berlinToUtc(o.start, o.event.start_time?.slice(0, 5) ?? ALL_DAY_BASE);
    const fireAt = new Date(start.getTime() - (o.event.reminder_minutes ?? 0) * 60_000);
    if (fireAt.getTime() > from && fireAt.getTime() <= now.getTime()) {
      result.push({ occurrence: o, fireAt, key: `rem:${o.event.id}:${o.start}:${o.event.reminder_minutes}` });
    }
  }
  return result;
}

/** Text wie "in 30 Min · 18:30 Uhr · Plauen". */
export function reminderBody(o: Occurrence): string {
  const m = o.event.reminder_minutes ?? 0;
  const allDay = !o.event.start_time;
  let when: string;
  if (m === 0) when = allDay ? "heute" : "jetzt";
  else if (m < 60) when = `in ${m} Min`;
  else if (m < 1440) when = `in ${m / 60} Std`;
  else if (m === 1440) when = "morgen";
  else if (m === 10080) when = "in einer Woche";
  else when = `in ${Math.round(m / 1440)} Tagen`;
  return [when, o.event.start_time && `${formatTime(o.event.start_time)} Uhr`, o.event.location]
    .filter(Boolean)
    .join(" · ");
}

/** Tagesübersicht für heute und morgen, oder null wenn nichts ansteht. */
export function dailySummary(events: CalendarEvent[], today: string): string | null {
  const tomorrow = addDays(today, 1);
  const label = (o: Occurrence) =>
    o.event.start_time && o.start === today ? `${o.event.title} ${formatTime(o.event.start_time)}` : o.event.title;
  const occ = expand(events, today, tomorrow);
  const todays = occ.filter((o) => o.start <= today && o.end >= today);
  const tomorrows = occ.filter((o) => o.start === tomorrow);
  const parts = [
    todays.length && `Heute: ${todays.map(label).join(", ")}`,
    tomorrows.length && `Morgen: ${tomorrows.map((o) => o.event.title).join(", ")}`,
  ].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}
