"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CrosswordBoard } from "@/components/crossword-board";
import { useCalendarMeta } from "@/lib/use-calendar-meta";
import { useProfiles } from "@/lib/use-profile";
import { useToday } from "@/lib/use-today";
import { formatDate } from "@/lib/calendar";

export function RaetselSpiel({ params }: { params: Promise<{ datum: string }> }) {
  const { datum } = use(params);
  const today = useToday();
  const { me } = useProfiles();
  const meta = useCalendarMeta();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(datum);

  return (
    <>
      <header className="mb-4 flex items-center gap-3">
        <Link href="/raetsel" className="rounded-lg p-1 text-muted hover:bg-foreground/5" aria-label="Zurück">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kreuzworträtsel</h1>
          {valid && (
            <p className="text-sm text-muted">
              {datum === today ? "Heute · " : ""}
              {formatDate(datum, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      </header>

      {!valid ? (
        <p className="text-sm text-muted">Ungültiges Datum.</p>
      ) : !today || !me ? (
        <div className="skeleton h-80 rounded-2xl" />
      ) : (
        <CrosswordBoard
          date={datum}
          isToday={datum === today}
          myId={me.id}
          people={meta.people}
          personColor={meta.personColor}
        />
      )}
    </>
  );
}
