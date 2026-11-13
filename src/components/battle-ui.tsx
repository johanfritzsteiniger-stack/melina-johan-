"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import type { Person } from "@/lib/use-calendar-meta";
import {
  formatValue,
  periodLabel,
  periodYear,
  summarize,
  type Battle,
  type PeriodResult,
} from "@/lib/battles";

/** Gegenüberstellung beider Personen mit Balken. */
export function Duel({
  battle,
  result,
  people,
  personColor,
  big,
}: {
  battle: Battle;
  result: PeriodResult | undefined;
  people: Person[];
  personColor: (id: string) => string;
  big?: boolean;
}) {
  const values = people.map((p) => result?.values[p.id] ?? null);
  const max = Math.max(1, ...values.map((v) => Math.abs(v ?? 0)));
  const lead = result?.winner ?? result?.leader ?? null;

  return (
    <div className="space-y-2">
      {people.map((p, i) => {
        const v = values[i];
        const isLead = lead === p.id;
        const color = personColor(p.id);
        // Bei "weniger gewinnt" ist der Balken kein Fortschritt, sondern nur Vergleich
        const width = v === null ? 0 : Math.max(4, (Math.abs(v) / max) * 100);
        return (
          <div key={p.id}>
            <div className={`flex items-baseline justify-between gap-2 ${big ? "text-base" : "text-sm"}`}>
              <span className="flex items-center gap-1.5 font-medium">
                {p.display_name}
                {isLead && <Crown size={big ? 16 : 14} className="text-amber-500" />}
              </span>
              <span className={`tabular-nums ${big ? "text-xl font-semibold" : "font-medium"}`}>
                {formatValue(v, battle.unit)}
              </span>
            </div>
            <div className={`mt-1 overflow-hidden rounded-full bg-foreground/5 ${big ? "h-2.5" : "h-1.5"}`}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${width}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Statuszeile zum laufenden Zeitraum. */
export function leadText(result: PeriodResult | undefined, people: Person[]): string {
  if (!result || result.leader === null) return "Noch keine Einträge";
  if (result.leader === "draw") return "Gleichstand";
  const name = people.find((p) => p.id === result.leader)?.display_name ?? "?";
  return result.finished ? `${name} hat gewonnen` : `${name} führt`;
}

/** Kachel für Übersicht und Startseite. */
export function BattleCard({
  battle,
  results,
  people,
  personColor,
  year,
}: {
  battle: Battle;
  results: PeriodResult[];
  people: Person[];
  personColor: (id: string) => string;
  year: number;
}) {
  const current = results.find((r) => !r.finished) ?? results[0];
  const label = current ? periodLabel(current.key, battle.period) : null;
  const ids = people.map((p) => p.id);
  const summary = summarize(
    battle.period === "none" ? [] : results.filter((r) => periodYear(r.key, battle.period) === year),
    ids,
  );

  return (
    <Link
      href={`/battles/${battle.id}`}
      className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent/50"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg">{battle.emoji || "🏆"}</span>
        <span className="flex-1 truncate font-semibold">{battle.name}</span>
        {label && battle.period !== "none" && (
          <span className="text-xs text-muted">
            {label.title} · {label.sub}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">{leadText(current, people)}</p>
      <Duel battle={battle} result={current} people={people} personColor={personColor} />
      {battle.period !== "none" && summary.played > 0 && (
        <p className="mt-4 text-xs text-muted">
          Bilanz {year}:{" "}
          {people.map((p, i) => (
            <span key={p.id}>
              {i > 0 && " : "}
              <span className="font-medium text-foreground">
                {p.display_name} {summary.wins[p.id] ?? 0}
              </span>
            </span>
          ))}
          {summary.draws > 0 && ` · ${summary.draws}× unentschieden`}
        </p>
      )}
    </Link>
  );
}
