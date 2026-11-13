// Battle-Logik: Zeiträume, Wertung, Sieger und Bilanz.
import { addDays, diffDays, fromISO, toISO } from "@/lib/calendar";

export type Period = "week" | "month" | "none";
export type Aggregate = "sum" | "best";

export type Battle = {
  id: string;
  name: string;
  emoji: string | null;
  unit: string;
  period: Period;
  aggregate: Aggregate;
  higher_wins: boolean;
  archived: boolean;
  sort: number;
  end_date: string | null;
};

export type Entry = {
  id: string;
  battle_id: string;
  person_id: string;
  date: string;
  value: number;
  note: string | null;
  created_at: string;
};

export const PERIODS: Record<Period, string> = {
  week: "Pro Woche",
  month: "Pro Monat",
  none: "Ohne Zeitraum (Gesamtstand)",
};

export const AGGREGATES: Record<Aggregate, string> = {
  sum: "Einträge addieren",
  best: "Bester Einzelwert zählt",
};

// ---------- Zeiträume ----------

/** Montag der Woche (YYYY-MM-DD). */
export function weekStart(iso: string): string {
  const d = fromISO(iso);
  const offset = (d.getDay() + 6) % 7;
  return addDays(iso, -offset);
}

/** ISO-Kalenderwoche und das Jahr, zu dem sie gehört. */
export function isoWeek(iso: string): { year: number; week: number } {
  const thursday = addDays(weekStart(iso), 3);
  const year = Number(thursday.slice(0, 4));
  const week = Math.floor(diffDays(`${year}-01-01`, thursday) / 7) + 1;
  return { year, week };
}

/** Schlüssel des Zeitraums, zu dem ein Datum gehört. */
export function periodKey(iso: string, period: Period): string {
  if (period === "week") return weekStart(iso);
  if (period === "month") return `${iso.slice(0, 7)}-01`;
  return "all";
}

/** Letzter Tag eines Zeitraums. */
export function periodEnd(key: string, period: Period): string {
  if (period === "week") return addDays(key, 6);
  if (period === "month") {
    const d = fromISO(key);
    return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));
  }
  return "9999-12-31";
}

/** Jahr, zu dem ein Zeitraum gezählt wird. */
export function periodYear(key: string, period: Period): number {
  if (period === "week") return isoWeek(key).year;
  if (period === "month") return Number(key.slice(0, 4));
  return 0;
}

export function periodLabel(key: string, period: Period): { title: string; sub: string } {
  if (period === "week") {
    const { week } = isoWeek(key);
    const end = addDays(key, 6);
    const fmt = (iso: string, withMonth: boolean) =>
      withMonth
        ? fromISO(iso).toLocaleDateString("de-DE", { day: "numeric", month: "short" })
        : `${fromISO(iso).getDate()}.`;
    const sameMonth = key.slice(0, 7) === end.slice(0, 7);
    return { title: `KW ${week}`, sub: `${fmt(key, !sameMonth)}–${fmt(end, true)}` };
  }
  if (period === "month") {
    return {
      title: fromISO(key).toLocaleDateString("de-DE", { month: "long" }),
      sub: key.slice(0, 4),
    };
  }
  return { title: "Gesamt", sub: "" };
}

/** Battle ist vorbei (Enddatum überschritten). */
export function isEnded(battle: Battle, today: string): boolean {
  return Boolean(battle.end_date && today && today > battle.end_date);
}

/** Landet im Archiv: manuell archiviert oder Enddatum vorbei. */
export function isArchived(battle: Battle, today: string): boolean {
  return battle.archived || isEnded(battle, today);
}

// ---------- Wertung ----------

export type PeriodResult = {
  key: string;
  values: Record<string, number | null>; // pro Person, null = kein Eintrag
  /** Personen-ID des Siegers, "draw" bei Gleichstand, null wenn noch offen/keine Daten */
  winner: string | "draw" | null;
  /** Wer gerade vorne liegt (auch bei laufendem Zeitraum) */
  leader: string | "draw" | null;
  finished: boolean;
};

function aggregate(values: number[], battle: Battle): number | null {
  if (values.length === 0) return null;
  if (battle.aggregate === "sum") return values.reduce((a, b) => a + b, 0);
  return battle.higher_wins ? Math.max(...values) : Math.min(...values);
}

function decide(values: Record<string, number | null>, battle: Battle): string | "draw" | null {
  const ids = Object.keys(values);
  // Fehlender Eintrag zählt als 0, wenn addiert wird und mehr gewinnt
  const scored = ids
    .map((id) => {
      const v = values[id];
      if (v === null) return battle.aggregate === "sum" && battle.higher_wins ? { id, v: 0, real: false } : null;
      return { id, v, real: true };
    })
    .filter((x): x is { id: string; v: number; real: boolean } => x !== null);

  if (!scored.some((s) => s.real)) return null;
  if (scored.length === 1) return scored[0].id;

  scored.sort((a, b) => (battle.higher_wins ? b.v - a.v : a.v - b.v));
  if (scored[0].v === scored[1].v) return "draw";
  return scored[0].id;
}

/** Ergebnisse aller Zeiträume mit Einträgen (plus aktueller Zeitraum), neueste zuerst. */
export function computeResults(
  battle: Battle,
  entries: Entry[],
  personIds: string[],
  today: string,
): PeriodResult[] {
  const groups = new Map<string, Map<string, number[]>>();
  const ensure = (key: string) => {
    if (!groups.has(key)) groups.set(key, new Map(personIds.map((id) => [id, []])));
    return groups.get(key)!;
  };

  const ended = isEnded(battle, today);
  for (const e of entries) {
    if (battle.end_date && e.date > battle.end_date) continue; // nach Ende zählt nichts mehr
    const g = ensure(periodKey(e.date, battle.period));
    if (!g.has(e.person_id)) g.set(e.person_id, []);
    g.get(e.person_id)!.push(Number(e.value));
  }
  if (today && !ended) ensure(periodKey(today, battle.period));

  return [...groups.entries()]
    .map(([key, byPerson]) => {
      const values: Record<string, number | null> = {};
      for (const [id, vals] of byPerson) values[id] = aggregate(vals, battle);
      const finished = ended || (battle.period !== "none" && today > periodEnd(key, battle.period));
      const leader = decide(values, battle);
      return { key, values, leader, winner: finished ? leader : null, finished };
    })
    .sort((a, b) => b.key.localeCompare(a.key));
}

export type Summary = {
  wins: Record<string, number>;
  draws: number;
  totals: Record<string, number>;
  played: number;
};

/** Bilanz über die gegebenen Zeiträume (nur abgeschlossene zählen als Sieg). */
export function summarize(results: PeriodResult[], personIds: string[]): Summary {
  const wins: Record<string, number> = Object.fromEntries(personIds.map((id) => [id, 0]));
  const totals: Record<string, number> = Object.fromEntries(personIds.map((id) => [id, 0]));
  let draws = 0;
  let played = 0;
  for (const r of results) {
    for (const id of personIds) totals[id] += r.values[id] ?? 0;
    if (!r.finished || r.winner === null) continue;
    played++;
    if (r.winner === "draw") draws++;
    else wins[r.winner] = (wins[r.winner] ?? 0) + 1;
  }
  return { wins, draws, totals, played };
}

export type Season = {
  year: number;
  summary: Summary;
  /** Saisonsieger nach Anzahl Siege, "draw" bei Gleichstand */
  champion: string | "draw" | null;
};

/** Abgeschlossene Saisons (Kalenderjahre vor dem aktuellen bzw. bis zum Enddatum). */
export function seasons(
  battle: Battle,
  results: PeriodResult[],
  personIds: string[],
  today: string,
): Season[] {
  if (battle.period === "none" || !today) return [];
  const currentYear = Number(today.slice(0, 4));
  const ended = isEnded(battle, today);
  const years = [...new Set(results.map((r) => periodYear(r.key, battle.period)))];
  return years
    .filter((y) => y < currentYear || ended)
    .sort((a, b) => b - a)
    .map((year) => {
      const summary = summarize(
        results.filter((r) => periodYear(r.key, battle.period) === year),
        personIds,
      );
      return { year, summary, champion: championOf(summary, personIds) };
    })
    .filter((s) => s.summary.played > 0);
}

export function championOf(summary: Summary, personIds: string[]): string | "draw" | null {
  if (summary.played === 0) return null;
  const sorted = [...personIds].sort((a, b) => (summary.wins[b] ?? 0) - (summary.wins[a] ?? 0));
  if (sorted.length > 1 && (summary.wins[sorted[0]] ?? 0) === (summary.wins[sorted[1]] ?? 0)) return "draw";
  return sorted[0] ?? null;
}

// ---------- Anzeige ----------

export function formatValue(v: number | null | undefined, unit?: string): string {
  if (v === null || v === undefined) return "–";
  const n = v.toLocaleString("de-DE", { maximumFractionDigits: 2 });
  return unit ? `${n} ${unit}` : n;
}
