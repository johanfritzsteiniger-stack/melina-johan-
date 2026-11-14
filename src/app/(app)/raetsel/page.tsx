"use client";

import Link from "next/link";
import { BookA, CheckCircle2, ChevronRight, Clock, Grid3x3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SkeletonList } from "@/components/skeleton";
import { ErrorBox } from "@/components/ui";
import { useTable } from "@/lib/use-table";
import { useToday } from "@/lib/use-today";
import { formatDate } from "@/lib/calendar";
import { formatDuration } from "@/lib/crossword/client";

type PuzzleInfo = {
  id: string;
  date: string;
  rows: number;
  cols: number;
  started_at: string | null;
  solved_at: string | null;
  hints_used: number;
};

function status(p: PuzzleInfo | undefined) {
  if (!p || !p.started_at) return "Noch nicht begonnen";
  if (p.solved_at) {
    const t = formatDuration(new Date(p.solved_at).getTime() - new Date(p.started_at).getTime());
    return `Gelöst in ${t}${p.hints_used ? ` · ${p.hints_used} ${p.hints_used === 1 ? "Hilfe" : "Hilfen"}` : ""}`;
  }
  return "Angefangen";
}

export default function RaetselPage() {
  const today = useToday();
  const { rows, loading, error } = useTable<PuzzleInfo>(
    "cw_puzzles",
    "id, date, rows, cols, started_at, solved_at, hints_used",
    [{ column: "date", ascending: false }],
  );
  const todays = rows.find((p) => p.date === today);
  const archive = rows.filter((p) => p.date !== today);
  const solvedCount = rows.filter((p) => p.solved_at).length;

  return (
    <>
      <PageHeader
        title="Kreuzworträtsel"
        subtitle="Jeden Tag ein neues – gemeinsam lösen"
        action={
          <Link href="/raetsel/woerter" className="flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-sm hover:bg-soft">
            <BookA size={16} /> Wörter
          </Link>
        }
      />

      {error && <ErrorBox text={error} />}

      {today && (
        <Link
          href={`/raetsel/${today}`}
          className="mb-8 flex items-center gap-4 rounded-2xl bg-soft p-5 text-soft-foreground transition-transform active:scale-[0.99]"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-card text-accent">
            <Grid3x3 size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm opacity-80">{formatDate(today, { weekday: "long", day: "numeric", month: "long" })}</p>
            <p className="text-lg font-semibold">Heutiges Rätsel</p>
            <p className="text-sm opacity-80">{status(todays)}</p>
          </div>
          <ChevronRight size={22} />
        </Link>
      )}

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Archiv</h2>
        {solvedCount > 0 && <span className="text-sm text-muted">{solvedCount} gelöst</span>}
      </div>

      {loading ? (
        <SkeletonList />
      ) : archive.length === 0 ? (
        <p className="text-sm text-muted">Ab morgen landen hier die vergangenen Rätsel – alle weiter spielbar.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
          {archive.map((p) => (
            <li key={p.id}>
              <Link href={`/raetsel/${p.date}`} className="flex items-center gap-3 p-4 hover:bg-soft/50">
                {p.solved_at ? (
                  <CheckCircle2 size={20} className="shrink-0 text-accent" />
                ) : (
                  <Clock size={20} className="shrink-0 text-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {formatDate(p.date, { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <span className="block text-xs text-muted">{status(p)}</span>
                </span>
                <ChevronRight size={18} className="text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
