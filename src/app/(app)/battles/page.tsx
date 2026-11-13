"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Crown, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SkeletonList } from "@/components/skeleton";
import { BattleDialog } from "@/components/battle-dialog";
import { BattleCard } from "@/components/battle-ui";
import { useBattles } from "@/lib/use-battles";
import { useCalendarMeta, type Person } from "@/lib/use-calendar-meta";
import { useToday } from "@/lib/use-today";
import { formatDate } from "@/lib/calendar";
import {
  championOf,
  computeResults,
  formatValue,
  isArchived,
  seasons,
  summarize,
  type Battle,
  type PeriodResult,
  type Summary,
} from "@/lib/battles";

export default function BattlesPage() {
  const { battles, entries, loading, error } = useBattles();
  const meta = useCalendarMeta();
  const today = useToday();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const ids = useMemo(() => meta.people.map((p) => p.id), [meta.people]);
  const withResults = useMemo(
    () =>
      battles.map((b) => ({
        battle: b,
        results: computeResults(
          b,
          entries.filter((e) => e.battle_id === b.id),
          ids,
          today,
        ),
      })),
    [battles, entries, ids, today],
  );

  const active = withResults.filter((x) => !isArchived(x.battle, today));
  const finished = withResults
    .filter((x) => isArchived(x.battle, today))
    .sort((a, b) => (b.battle.end_date ?? "").localeCompare(a.battle.end_date ?? ""));

  // Abgeschlossene Saisons laufender Battles, nach Jahr gruppiert
  const seasonsByYear = useMemo(() => {
    const map = new Map<number, { battle: Battle; summary: Summary; champion: string | "draw" | null }[]>();
    for (const { battle, results } of withResults) {
      if (isArchived(battle, today)) continue;
      for (const s of seasons(battle, results, ids, today)) {
        map.set(s.year, [...(map.get(s.year) ?? []), { battle, ...s }]);
      }
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [withResults, ids, today]);

  const year = today ? Number(today.slice(0, 4)) : 0;
  const hasArchive = finished.length > 0 || seasonsByYear.length > 0;

  return (
    <>
      <PageHeader
        title="Battles"
        action={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Battle</span>
          </button>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <SkeletonList />
      ) : active.length === 0 && !error ? (
        <button
          onClick={() => setCreating(true)}
          className="w-full rounded-2xl border border-dashed border-border p-8 text-sm text-muted hover:border-accent/50"
        >
          Kein laufendes Battle – jetzt eins anlegen
        </button>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map(({ battle, results }) => (
            <BattleCard
              key={battle.id}
              battle={battle}
              results={results}
              people={meta.people}
              personColor={meta.personColor}
              year={year}
            />
          ))}
        </div>
      )}

      {hasArchive && (
        <section className="mt-10 space-y-6">
          <h2 className="text-lg font-semibold">Archiv</h2>

          {seasonsByYear.map(([y, list]) => (
            <div key={y}>
              <h3 className="mb-2 text-sm font-medium text-muted">Saison {y}</h3>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {list.map(({ battle, summary, champion }) => (
                  <ArchiveRow
                    key={battle.id}
                    battle={battle}
                    people={meta.people}
                    personColor={meta.personColor}
                    champion={champion}
                    detail={people(meta.people, summary)}
                  />
                ))}
              </ul>
            </div>
          ))}

          {finished.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted">Beendete Battles</h3>
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {finished.map(({ battle, results }) => (
                  <ArchiveRow
                    key={battle.id}
                    battle={battle}
                    people={meta.people}
                    personColor={meta.personColor}
                    {...finalResult(battle, results, meta.people, ids)}
                    date={battle.end_date}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {creating && (
        <BattleDialog
          battle={null}
          nextSort={Math.max(0, ...battles.map((b) => b.sort)) + 1}
          onClose={() => setCreating(false)}
          onSaved={(id) => router.push(`/battles/${id}`)}
        />
      )}
    </>
  );
}

/** "Johan 30 : 22 Melina" */
function people(list: Person[], summary: Summary): string {
  return list.map((p) => `${p.display_name} ${summary.wins[p.id] ?? 0}`).join(" : ") +
    (summary.draws ? ` · ${summary.draws}× unentschieden` : "");
}

/** Endergebnis eines beendeten Battles. */
function finalResult(battle: Battle, results: PeriodResult[], list: Person[], ids: string[]) {
  if (battle.period === "none") {
    const r = results[0];
    return {
      champion: r?.leader ?? null,
      detail: list.map((p) => `${p.display_name} ${formatValue(r?.values[p.id] ?? null, battle.unit)}`).join(" : "),
    };
  }
  const summary = summarize(results, ids);
  return { champion: championOf(summary, ids), detail: people(list, summary) };
}

function ArchiveRow({
  battle,
  people: list,
  personColor,
  champion,
  detail,
  date,
}: {
  battle: Battle;
  people: Person[];
  personColor: (id: string) => string;
  champion: string | "draw" | null;
  detail: string;
  date?: string | null;
}) {
  const winner = list.find((p) => p.id === champion);
  return (
    <li>
      <Link href={`/battles/${battle.id}`} className="flex items-center gap-3 p-4 hover:bg-foreground/5">
        <span className="text-lg">{battle.emoji || "🏆"}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{battle.name}</span>
          <span className="block truncate text-xs text-muted">
            {date && `bis ${formatDate(date, { day: "numeric", month: "short", year: "numeric" })} · `}
            {detail}
          </span>
        </span>
        {champion === "draw" ? (
          <span className="shrink-0 text-xs text-muted">unentschieden</span>
        ) : winner ? (
          <span className="flex shrink-0 items-center gap-1 text-sm font-medium" style={{ color: personColor(winner.id) }}>
            <Crown size={14} />
            {winner.display_name}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
