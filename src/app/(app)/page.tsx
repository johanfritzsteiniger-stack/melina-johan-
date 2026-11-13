"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { CalendarDays, ListChecks, Timer, Trophy } from "lucide-react";
import { useProfiles } from "@/lib/use-profile";

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Hallo";
  return "Guten Abend";
}

const noop = () => () => {};

function todayLabel() {
  return new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const CARDS = [
  {
    href: "/kalender",
    title: "Countdowns",
    icon: Timer,
    empty: "Noch kein Countdown angelegt.",
  },
  {
    href: "/kalender",
    title: "Nächste Termine",
    icon: CalendarDays,
    empty: "Keine anstehenden Termine.",
  },
  {
    href: "/battles",
    title: "Battles diese Woche",
    icon: Trophy,
    empty: "Noch keine Battles.",
  },
  {
    href: "/listen",
    title: "Offene Listen",
    icon: ListChecks,
    empty: "Keine offenen Einträge.",
  },
];

export default function DashboardPage() {
  const { me, loading } = useProfiles();
  // Datum erst im Browser berechnen (nicht beim Vorrendern)
  const today = useSyncExternalStore(noop, todayLabel, () => "");
  const hello = useSyncExternalStore(noop, () => greeting(new Date()), () => "Hallo");

  return (
    <>
      <header className="mb-6">
        <p className="h-5 text-sm text-muted">{today}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {loading ? "\u00a0" : me ? `${hello}, ${me.display_name}` : hello}
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map(({ href, title, icon: Icon, empty }) => (
          <Link
            key={title}
            href={href}
            className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent/50"
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Icon size={18} className="text-accent" />
              {title}
            </div>
            <p className="text-sm text-muted">{empty}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
