"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { BattleDialog } from "@/components/battle-dialog";
import { BattleCard } from "@/components/battle-ui";
import { useBattles } from "@/lib/use-battles";
import { useCalendarMeta } from "@/lib/use-calendar-meta";
import { useToday } from "@/lib/use-today";
import { computeResults } from "@/lib/battles";

export default function BattlesPage() {
  const { battles, entries, loading, error } = useBattles();
  const meta = useCalendarMeta();
  const today = useToday();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

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

  const active = withResults.filter((x) => !x.battle.archived);
  const archived = withResults.filter((x) => x.battle.archived);
  const year = today ? Number(today.slice(0, 4)) : 0;

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
        <p className="text-sm text-muted">Lädt …</p>
      ) : active.length === 0 && !error ? (
        <button
          onClick={() => setCreating(true)}
          className="w-full rounded-2xl border border-dashed border-border p-8 text-sm text-muted hover:border-accent/50"
        >
          Noch kein Battle – jetzt eins anlegen
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

      {archived.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowArchived((s) => !s)} className="text-sm text-muted hover:text-foreground">
            {showArchived ? "Archiv ausblenden" : `Archiv anzeigen (${archived.length})`}
          </button>
          {showArchived && (
            <div className="mt-4 grid gap-4 opacity-80 sm:grid-cols-2">
              {archived.map(({ battle, results }) => (
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
        </div>
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
