"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { diffDays, formatDate, yearsMonthsDays } from "@/lib/calendar";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Feste Anzeige auf der Startseite: wie lange ihr schon zusammen seid. */
export function TogetherCard({ since, today }: { since: string | null; today: string }) {
  if (!today) return <div className="mb-6 h-[104px] rounded-2xl border border-border bg-card" />;

  if (!since) {
    return (
      <Link
        href="/einstellungen"
        className="mb-6 flex items-center gap-3 rounded-2xl border border-dashed border-border p-5 text-sm text-muted hover:border-accent/50"
      >
        <Heart size={18} className="text-accent" />
        Datum, seit dem ihr zusammen seid, in den Einstellungen eintragen
      </Link>
    );
  }

  if (since > today) {
    return (
      <div className="mb-6 rounded-2xl border border-border bg-card p-5 text-sm text-muted">
        Das eingetragene Datum ({formatDate(since, { day: "numeric", month: "long", year: "numeric" })}) liegt in der Zukunft.
      </div>
    );
  }

  const { years, months, days } = yearsMonthsDays(since, today);
  const total = diffDays(since, today);

  // Nächster Jahrestag
  const thisYear = Number(today.slice(0, 4));
  let next = `${thisYear}-${since.slice(5)}`;
  if (next < today) next = `${thisYear + 1}-${since.slice(5)}`;
  const toAnniversary = diffDays(today, next);
  const nextNumber = Number(next.slice(0, 4)) - Number(since.slice(0, 4));

  const parts = [
    years > 0 && plural(years, "Jahr", "Jahre"),
    (years > 0 || months > 0) && plural(months, "Monat", "Monate"),
    plural(days, "Tag", "Tage"),
  ].filter(Boolean) as string[];

  return (
    <section className="mb-6 rounded-2xl bg-soft p-5 text-soft-foreground">
      <div className="flex items-center gap-2 text-sm opacity-80">
        <Heart size={16} className="text-accent" />
        Zusammen seit {formatDate(since, { day: "numeric", month: "long", year: "numeric" })}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
        {parts.join(" · ")}
      </p>
      <p className="mt-1 text-sm opacity-80">
        {total.toLocaleString("de-DE")} Tage insgesamt ·{" "}
        {toAnniversary === 0
          ? `heute ${nextNumber}. Jahrestag`
          : `${nextNumber}. Jahrestag in ${plural(toAnniversary, "Tag", "Tagen")}`}
      </p>
    </section>
  );
}
