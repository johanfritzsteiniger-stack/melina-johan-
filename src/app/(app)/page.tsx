"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarDays, ListChecks, Timer, Trophy, Wallet } from "lucide-react";
import { useProfiles } from "@/lib/use-profile";
import { useEvents } from "@/lib/use-events";
import { useToday } from "@/lib/use-today";
import { useCalendarMeta } from "@/lib/use-calendar-meta";
import { useBattles } from "@/lib/use-battles";
import { computeResults, isArchived } from "@/lib/battles";
import { leadText } from "@/components/battle-ui";
import { TogetherCard } from "@/components/together-card";
import { useTable } from "@/lib/use-table";
import { LIST_COLUMNS, isListArchived, type List, type ListItem } from "@/lib/lists";
import { EXPENSE_COLUMNS, balance, euro, type Expense } from "@/lib/expenses";
import {
  addDays,
  ageAt,
  diffDays,
  expand,
  formatDate,
  formatRange,
  nextOccurrence,
  relativeLabel,
  type Occurrence,
} from "@/lib/calendar";

function greeting(today: string) {
  if (!today) return "Hallo";
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Hallo";
  return "Guten Abend";
}

export default function DashboardPage() {
  const { me, loading } = useProfiles();
  const { events } = useEvents();
  const today = useToday();
  const meta = useCalendarMeta();

  const countdowns = useMemo(() => {
    if (!today) return [];
    return events
      .filter((e) => e.is_countdown)
      .map((e) => nextOccurrence(e, today))
      .filter((o): o is Occurrence => o !== null)
      .sort((a, b) => a.start.localeCompare(b.start));
  }, [events, today]);

  const { battles, entries } = useBattles();
  const battleStatus = useMemo(() => {
    const ids = meta.people.map((p) => p.id);
    return battles
      .filter((b) => !isArchived(b, today))
      .map((battle) => {
        const results = computeResults(
          battle,
          entries.filter((e) => e.battle_id === battle.id),
          ids,
          today,
        );
        return { battle, current: results.find((r) => !r.finished) ?? results[0] };
      });
  }, [battles, entries, meta.people, today]);

  const lists = useTable<List>("lists", LIST_COLUMNS, [{ column: "sort" }]);
  const items = useTable<ListItem>("list_items", "list_id, done_at", []);
  const activeLists = useMemo(
    () =>
      lists.rows
        .filter((l) => !isListArchived(l, today))
        .map((list) => ({
          list,
          open: items.rows.filter((i) => i.list_id === list.id && !i.done_at).length,
        })),
    [lists.rows, items.rows, today],
  );

  const expenses = useTable<Expense>("expenses", EXPENSE_COLUMNS, []);
  const bal = balance(
    expenses.rows.filter((e) => !e.settlement_id),
    meta.people.map((p) => p.id),
  );
  const personName = (id: string) => meta.people.find((p) => p.id === id)?.display_name ?? "?";

  const upcoming = useMemo(
    () => (today ? expand(events, today, addDays(today, 30)).slice(0, 5) : []),
    [events, today],
  );

  return (
    <>
      <header className="mb-6">
        <p className="h-5 text-sm text-muted">
          {today && formatDate(today, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {loading ? " " : me ? `${greeting(today)}, ${me.display_name}` : greeting(today)}
        </h1>
      </header>

      <TogetherCard since={meta.togetherSince} today={today} />

      {countdowns.length > 0 && (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {countdowns.map((o) => (
            <CountdownCard
              key={o.event.id}
              o={o}
              today={today}
              color={meta.colorOf(o.event)}
              subtitle={[meta.ownerLabel(o.event), meta.categoryOf(o.event)?.name]
                .filter(Boolean)
                .join(" · ")}
            />
          ))}
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {countdowns.length === 0 && (
          <Card href="/kalender" title="Countdowns" icon={Timer}>
            <p className="text-sm text-muted">
              Noch kein Countdown. Beim Anlegen eines Termins „Als Countdown auf der Startseite
              zeigen“ anhaken.
            </p>
          </Card>
        )}

        <Card href="/kalender" title="Nächste Termine" icon={CalendarDays}>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">In den nächsten 30 Tagen steht nichts an.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((o) => {
                const age = ageAt(o.event, o.start, meta.categoryOf(o.event));
                return (
                  <li key={`${o.event.id}-${o.start}`} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.colorOf(o.event) }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {o.event.title}
                      {age ? ` (${age})` : ""}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{relativeLabel(o, today)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card href="/battles" title="Battles" icon={Trophy}>
          {battleStatus.length === 0 ? (
            <p className="text-sm text-muted">Noch keine Battles.</p>
          ) : (
            <ul className="space-y-2">
              {battleStatus.map(({ battle, current }) => (
                <li key={battle.id} className="flex items-center gap-2 text-sm">
                  <span>{battle.emoji || "🏆"}</span>
                  <span className="min-w-0 flex-1 truncate">{battle.name}</span>
                  <span className="shrink-0 text-xs text-muted">{leadText(current, meta.people)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card href="/listen" title="Listen" icon={ListChecks}>
          {activeLists.length === 0 ? (
            <p className="text-sm text-muted">Keine offenen Listen.</p>
          ) : (
            <ul className="space-y-2">
              {activeLists.slice(0, 5).map(({ list, open }) => (
                <li key={list.id} className="flex items-center gap-2 text-sm">
                  <span>{list.emoji || "📝"}</span>
                  <span className="min-w-0 flex-1 truncate">{list.name}</span>
                  <span className="shrink-0 text-xs text-muted">{open === 0 ? "erledigt" : `${open} offen`}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card href="/ausgaben" title="Ausgaben" icon={Wallet}>
          <p className="text-sm">
            {bal ? (
              <>
                <span className="font-medium">{personName(bal.from)}</span> schuldet{" "}
                <span className="font-medium">{personName(bal.to)}</span>{" "}
                <span className="font-semibold tabular-nums">{euro(bal.amount)}</span>
              </>
            ) : (
              <span className="text-muted">Ihr seid quitt.</span>
            )}
          </p>
        </Card>
      </div>
    </>
  );
}

function Card({
  href,
  title,
  icon: Icon,
  children,
}: {
  href: string;
  title: string;
  icon: typeof Timer;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent/50"
    >
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <Icon size={18} className="text-accent" />
        {title}
      </div>
      {children}
    </Link>
  );
}

function CountdownCard({
  o,
  today,
  color,
  subtitle,
}: {
  o: Occurrence;
  today: string;
  color: string;
  subtitle: string;
}) {
  const days = diffDays(today, o.start);
  const running = o.start <= today && o.end >= today;
  const total = o.event.end_date ? diffDays(o.start, o.end) + 1 : 1;
  const dayOf = diffDays(o.start, today) + 1;

  return (
    <Link
      href="/kalender"
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent/50"
    >
      <div
        className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}1f`, color }}
      >
        {running ? (
          <span className="text-xs font-semibold">jetzt</span>
        ) : (
          <>
            <span className="text-2xl leading-none font-semibold tabular-nums">{days}</span>
            <span className="text-[11px]">{days === 1 ? "Tag" : "Tage"}</span>
          </>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{o.event.title}</p>
        <p className="text-sm text-muted">
          {running && total > 1 ? `Tag ${dayOf} von ${total}` : formatRange(o)}
        </p>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
    </Link>
  );
}
