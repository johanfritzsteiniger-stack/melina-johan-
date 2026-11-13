"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, Pencil, Trash2 } from "lucide-react";
import { BattleDialog } from "@/components/battle-dialog";
import { Duel, leadText } from "@/components/battle-ui";
import { getSupabase } from "@/lib/supabase/client";
import { useBattles } from "@/lib/use-battles";
import { useCalendarMeta } from "@/lib/use-calendar-meta";
import { useProfiles } from "@/lib/use-profile";
import { useToday } from "@/lib/use-today";
import { formatDate } from "@/lib/calendar";
import { notifyPartner } from "@/lib/push-client";
import {
  AGGREGATES,
  computeResults,
  formatValue,
  isEnded,
  periodLabel,
  periodYear,
  summarize,
  type Battle,
  type PeriodResult,
} from "@/lib/battles";

const input =
  "w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent";

export function BattleDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { battles, entries, loading, error } = useBattles();
  const meta = useCalendarMeta();
  const today = useToday();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  const battle = battles.find((b) => b.id === id);
  const myEntries = useMemo(() => entries.filter((e) => e.battle_id === id), [entries, id]);
  const ids = useMemo(() => meta.people.map((p) => p.id), [meta.people]);
  const results = useMemo(
    () => (battle ? computeResults(battle, myEntries, ids, today) : []),
    [battle, myEntries, ids, today],
  );

  if (loading || !today) return null;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!battle) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Dieses Battle gibt es nicht (mehr).</p>
        <Link href="/battles" className="text-sm text-accent">
          Zurück zu den Battles
        </Link>
      </div>
    );
  }

  const current = results.find((r) => !r.finished) ?? results[0];
  const currentLabel = current ? periodLabel(current.key, battle.period) : null;

  const years = [...new Set(results.map((r) => periodYear(r.key, battle.period)))].sort((a, b) => b - a);
  const thisYear = Number(today.slice(0, 4));
  const shownYear = year ?? (years.includes(thisYear) ? thisYear : (years[0] ?? thisYear));
  const yearResults = results.filter((r) => periodYear(r.key, battle.period) === shownYear);
  const yearSummary = summarize(yearResults, ids);
  const allSummary = summarize(results, ids);

  return (
    <>
      <header className="mb-6 flex items-start gap-3">
        <Link href="/battles" className="mt-1 rounded-lg p-1 text-muted hover:bg-foreground/5" aria-label="Zurück">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {battle.emoji || "🏆"} {battle.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {battle.period === "week" ? "Wöchentlich" : battle.period === "month" ? "Monatlich" : "Gesamtstand"} ·{" "}
            {battle.higher_wins ? "mehr gewinnt" : "weniger gewinnt"} · {AGGREGATES[battle.aggregate].toLowerCase()}
            {battle.end_date &&
              ` · ${isEnded(battle, today) ? "beendet am" : "endet am"} ${formatDate(battle.end_date, { day: "numeric", month: "short", year: "numeric" })}`}
            {battle.archived && " · archiviert"}
          </p>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg p-2 text-muted hover:bg-foreground/5"
          aria-label="Battle bearbeiten"
        >
          <Pencil size={18} />
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Aktueller Zeitraum */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">
                {battle.period === "none" ? "Stand" : currentLabel?.title}
                {currentLabel?.sub && <span className="ml-2 text-sm font-normal text-muted">{currentLabel.sub}</span>}
              </h2>
              {current && !current.finished && battle.period !== "none" && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">läuft</span>
              )}
            </div>
            <p className="mb-4 text-sm text-muted">{leadText(current, meta.people)}</p>
            <Duel battle={battle} result={current} people={meta.people} personColor={meta.personColor} big />
          </section>

          {/* Am Handy: Eintragen direkt unter dem aktuellen Stand */}
          {!battle.archived && !isEnded(battle, today) && (
            <div className="lg:hidden">
              <EntryForm battle={battle} today={today} people={meta.people} personColor={meta.personColor} />
            </div>
          )}

          {/* Tabelle */}
          {battle.period !== "none" && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="font-semibold">Saison {shownYear}</h2>
                {years.length > 1 && (
                  <select
                    value={shownYear}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <SummaryRow battle={battle} summary={yearSummary} people={meta.people} personColor={meta.personColor} label={String(shownYear)} />

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="py-2 pr-2 font-normal">{battle.period === "week" ? "Woche" : "Monat"}</th>
                      {meta.people.map((p) => (
                        <th key={p.id} className="px-2 py-2 text-right font-normal">
                          {p.display_name}
                        </th>
                      ))}
                      <th className="py-2 pl-2 text-right font-normal">Sieger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearResults.map((r) => (
                      <ResultRow key={r.key} battle={battle} r={r} people={meta.people} personColor={meta.personColor} />
                    ))}
                  </tbody>
                </table>
              </div>

              {years.length > 1 && (
                <div className="mt-4 border-t border-border pt-4">
                  <SummaryRow battle={battle} summary={allSummary} people={meta.people} personColor={meta.personColor} label="Insgesamt" />
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {!battle.archived && !isEnded(battle, today) && (
            <div className="hidden lg:block">
              <EntryForm battle={battle} today={today} people={meta.people} personColor={meta.personColor} />
            </div>
          )}
          <EntryList battle={battle} entries={myEntries} people={meta.people} personColor={meta.personColor} />
        </aside>
      </div>

      {editing && (
        <BattleDialog
          battle={battle}
          nextSort={0}
          onClose={() => setEditing(false)}
          onSaved={() => {}}
          onDeleted={() => router.replace("/battles")}
        />
      )}
    </>
  );
}

type People = ReturnType<typeof useCalendarMeta>["people"];
type ColorFn = (id: string) => string;

function SummaryRow({
  battle,
  summary,
  people,
  personColor,
  label,
}: {
  battle: Battle;
  summary: ReturnType<typeof summarize>;
  people: People;
  personColor: ColorFn;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">
        {label}: {summary.played} {battle.period === "week" ? (summary.played === 1 ? "Woche" : "Wochen") : summary.played === 1 ? "Monat" : "Monate"} gewertet
        {summary.draws > 0 && `, ${summary.draws}× unentschieden`}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {people.map((p) => (
          <div key={p.id} className="rounded-xl p-3" style={{ backgroundColor: `${personColor(p.id)}14` }}>
            <p className="text-sm font-medium">{p.display_name}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {summary.wins[p.id] ?? 0}
              <span className="ml-1 text-sm font-normal text-muted">Siege</span>
            </p>
            <p className="text-xs text-muted">gesamt {formatValue(summary.totals[p.id] ?? 0, battle.unit)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultRow({
  battle,
  r,
  people,
  personColor,
}: {
  battle: Battle;
  r: PeriodResult;
  people: People;
  personColor: ColorFn;
}) {
  const label = periodLabel(r.key, battle.period);
  const winner = r.finished ? r.winner : r.leader;
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-2">
        <span className="font-medium">{label.title}</span>
        <span className="ml-1.5 text-xs text-muted">{label.sub}</span>
      </td>
      {people.map((p) => (
        <td
          key={p.id}
          className={`px-2 py-2 text-right tabular-nums ${winner === p.id ? "font-semibold" : "text-muted"}`}
        >
          {formatValue(r.values[p.id])}
        </td>
      ))}
      <td className="py-2 pl-2 text-right">
        {!r.finished ? (
          <span className="text-xs text-muted">läuft</span>
        ) : winner === "draw" ? (
          <span className="text-xs text-muted">unentschieden</span>
        ) : winner ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: personColor(winner) }}>
            <Crown size={12} />
            {people.find((p) => p.id === winner)?.display_name}
          </span>
        ) : (
          <span className="text-xs text-muted">–</span>
        )}
      </td>
    </tr>
  );
}

function EntryForm({
  battle,
  today,
  people,
  personColor,
}: {
  battle: Battle;
  today: string;
  people: People;
  personColor: ColorFn;
}) {
  const { me } = useProfiles();
  const [personId, setPersonId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const who = personId ?? me?.id ?? people[0]?.id ?? null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(value.replace(",", "."));
    if (!who || value.trim() === "" || Number.isNaN(num)) {
      setStatus("Bitte eine Zahl eingeben.");
      return;
    }
    setSaving(true);
    const { error } = await getSupabase().from("battle_entries").insert({
      battle_id: battle.id,
      person_id: who,
      date,
      value: num,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      setStatus("Speichern hat nicht geklappt: " + error.message);
      return;
    }
    setValue("");
    setNote("");
    setStatus("Eingetragen.");
    const whoName = people.find((p) => p.id === who)?.display_name;
    notifyPartner(
      `${battle.emoji ?? "🏆"} ${battle.name}`,
      `${who === me?.id ? "" : `für ${whoName}: `}${formatValue(num, battle.unit)} eingetragen`,
      `/battles/${battle.id}`,
    );
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">Eintragen</h2>

      <div className="grid grid-cols-2 gap-2">
        {people.map((p) => {
          const active = who === p.id;
          const color = personColor(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPersonId(p.id)}
              style={active ? { borderColor: color, backgroundColor: `${color}1f` } : undefined}
              className={`truncate rounded-lg border px-2 py-2 text-sm ${active ? "font-medium" : "border-border text-muted"}`}
            >
              {p.display_name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-muted">Wert ({battle.unit})</span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setStatus(null);
            }}
            className={`${input} text-base font-medium`}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted">Datum</span>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </label>
      </div>

      <input placeholder="Notiz (optional)" value={note} onChange={(e) => setNote(e.target.value)} className={input} />

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
      >
        {saving ? "Speichern …" : "Eintragen"}
      </button>

      <p className="text-xs text-muted">
        {status ??
          (battle.aggregate === "sum"
            ? `Mehrere Einträge im selben Zeitraum werden zusammengezählt.`
            : `Im Zeitraum zählt der beste Einzelwert.`)}
      </p>
    </form>
  );
}

function EntryList({
  battle,
  entries,
  people,
  personColor,
}: {
  battle: Battle;
  entries: ReturnType<typeof useBattles>["entries"];
  people: People;
  personColor: ColorFn;
}) {
  const [limit, setLimit] = useState(10);
  if (entries.length === 0) return null;
  const sorted = [...entries].sort(
    (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
  );

  async function remove(id: string) {
    if (!window.confirm("Eintrag löschen?")) return;
    await getSupabase().from("battle_entries").delete().eq("id", id);
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 font-semibold">Letzte Einträge</h2>
      <ul className="divide-y divide-border">
        {sorted.slice(0, limit).map((e) => {
          const person = people.find((p) => p.id === e.person_id);
          return (
            <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: personColor(e.person_id) }} />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{person?.display_name ?? "?"}</span>
                <span className="ml-2 text-xs text-muted">{formatDate(e.date, { day: "numeric", month: "short" })}</span>
                {e.note && <span className="block truncate text-xs text-muted">{e.note}</span>}
              </span>
              <span className="tabular-nums">{formatValue(e.value, battle.unit)}</span>
              <button
                onClick={() => remove(e.id)}
                className="rounded p-1 text-muted hover:bg-red-500/10 hover:text-red-600"
                aria-label="Eintrag löschen"
              >
                <Trash2 size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      {entries.length > limit && (
        <button onClick={() => setLimit((l) => l + 20)} className="mt-2 text-sm text-muted hover:text-foreground">
          Mehr anzeigen
        </button>
      )}
    </section>
  );
}
