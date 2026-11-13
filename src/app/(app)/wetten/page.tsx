"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Crown, Gift, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DeleteButton, ErrorBox, Field, Modal, SaveButtons, inputClass } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { useTable } from "@/lib/use-table";
import { useToday } from "@/lib/use-today";
import { useCalendarMeta, type Person } from "@/lib/use-calendar-meta";
import { formatDate } from "@/lib/calendar";
import { notifyPartner } from "@/lib/push-client";

type Bet = {
  id: string;
  title: string;
  positions: Record<string, string>;
  stake: string | null;
  due_date: string | null;
  winner_id: string | null;
  is_draw: boolean;
  resolved_at: string | null;
  stake_paid: boolean;
  created_at: string;
};

const COLUMNS = "id, title, positions, stake, due_date, winner_id, is_draw, resolved_at, stake_paid, created_at";

export default function WettenPage() {
  const { rows, loading, error } = useTable<Bet>("bets", COLUMNS, [{ column: "created_at", ascending: false }]);
  const meta = useCalendarMeta();
  const today = useToday();
  const [edit, setEdit] = useState<{ bet: Bet | null } | null>(null);
  const [resolve, setResolve] = useState<Bet | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const open = rows
    .filter((b) => !b.resolved_at)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const resolved = rows
    .filter((b) => b.resolved_at)
    .sort((a, b) => (b.resolved_at ?? "").localeCompare(a.resolved_at ?? ""));
  const unpaid = resolved.filter((b) => !b.is_draw && b.winner_id && b.stake && !b.stake_paid);

  const wins = Object.fromEntries(meta.people.map((p) => [p.id, resolved.filter((b) => b.winner_id === p.id).length]));
  const draws = resolved.filter((b) => b.is_draw).length;
  const name = (id: string | null) => meta.people.find((p) => p.id === id)?.display_name ?? "?";
  const loserOf = (b: Bet) => meta.people.find((p) => p.id !== b.winner_id);

  async function markPaid(b: Bet, paid: boolean) {
    await getSupabase().from("bets").update({ stake_paid: paid }).eq("id", b.id);
  }

  return (
    <>
      <PageHeader
        title="Wetten"
        action={
          <button
            onClick={() => setEdit({ bet: null })}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Wette</span>
          </button>
        }
      />

      {error && <ErrorBox text={error} />}

      {resolved.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          {meta.people.map((p) => (
            <div key={p.id} className="rounded-2xl p-4" style={{ backgroundColor: `${meta.personColor(p.id)}14` }}>
              <p className="text-sm font-medium">{p.display_name}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {wins[p.id] ?? 0} <span className="text-sm font-normal text-muted">gewonnen</span>
              </p>
            </div>
          ))}
          {draws > 0 && <p className="col-span-2 text-xs text-muted">{draws}× unentschieden</p>}
        </div>
      )}

      {unpaid.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-muted">Offene Einsätze</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-amber-500/40 bg-amber-500/5">
            {unpaid.map((b) => (
              <li key={b.id} className="flex items-center gap-3 p-4">
                <Gift size={18} className="shrink-0 text-amber-500" />
                <span className="min-w-0 flex-1">
                  <span className="block">
                    <strong>{loserOf(b)?.display_name}</strong> schuldet {name(b.winner_id)}: {b.stake}
                  </span>
                  <span className="block truncate text-xs text-muted">{b.title}</span>
                </span>
                <button
                  onClick={() => markPaid(b, true)}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-xs hover:border-accent hover:text-accent"
                >
                  <Check size={14} /> Eingelöst
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mb-2 text-sm font-medium text-muted">Laufende Wetten</h2>
      {loading ? (
        <p className="text-sm text-muted">Lädt …</p>
      ) : open.length === 0 && !error ? (
        <button
          onClick={() => setEdit({ bet: null })}
          className="w-full rounded-2xl border border-dashed border-border p-8 text-sm text-muted hover:border-accent/50"
        >
          Keine laufende Wette – worum wettet ihr?
        </button>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {open.map((b) => {
            const overdue = b.due_date && today && b.due_date <= today;
            return (
              <li key={b.id} className="flex flex-col rounded-2xl border border-border bg-card p-4">
                <button onClick={() => setEdit({ bet: b })} className="text-left">
                  <span className="block font-medium">{b.title}</span>
                  <span className="mt-2 block space-y-1">
                    {meta.people.map((p) =>
                      b.positions?.[p.id] ? (
                        <span key={p.id} className="flex gap-2 text-sm">
                          <span className="shrink-0 font-medium" style={{ color: meta.personColor(p.id) }}>
                            {p.display_name}:
                          </span>
                          <span className="text-muted">{b.positions[p.id]}</span>
                        </span>
                      ) : null,
                    )}
                  </span>
                </button>
                <div className="mt-3 flex flex-1 items-end justify-between gap-2">
                  <span className="text-xs text-muted">
                    {b.stake && <>Einsatz: {b.stake}</>}
                    {b.stake && b.due_date && " · "}
                    {b.due_date && (
                      <span className={overdue ? "font-medium text-amber-600" : ""}>
                        {overdue ? "fällig seit " : "bis "}
                        {formatDate(b.due_date)}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => setResolve(b)}
                    className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
                  >
                    Auflösen
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {resolved.length > 0 && (
        <section className="mt-10">
          <button onClick={() => setShowArchive((s) => !s)} className="flex items-center gap-2 text-lg font-semibold">
            {showArchive ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            Archiv <span className="text-sm font-normal text-muted">({resolved.length})</span>
          </button>
          {showArchive && (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {resolved.map((b) => (
                <li key={b.id}>
                  <button onClick={() => setResolve(b)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-foreground/5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{b.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {formatDate(b.resolved_at!.slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}
                        {b.stake && ` · ${b.stake}`}
                        {b.stake && !b.is_draw && (b.stake_paid ? " · eingelöst" : " · offen")}
                      </span>
                    </span>
                    {b.is_draw ? (
                      <span className="shrink-0 text-xs text-muted">unentschieden</span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-sm font-medium" style={{ color: meta.personColor(b.winner_id) }}>
                        <Crown size={14} /> {name(b.winner_id)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {edit && <BetDialog bet={edit.bet} people={meta.people} onClose={() => setEdit(null)} />}
      {resolve && (
        <ResolveDialog bet={resolve} people={meta.people} personColor={meta.personColor} onClose={() => setResolve(null)} onPaid={markPaid} />
      )}
    </>
  );
}

function BetDialog({ bet, people, onClose }: { bet: Bet | null; people: Person[]; onClose: () => void }) {
  const [title, setTitle] = useState(bet?.title ?? "");
  const [positions, setPositions] = useState<Record<string, string>>(bet?.positions ?? {});
  const [stake, setStake] = useState(bet?.stake ?? "");
  const [due, setDue] = useState(bet?.due_date ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) return;
    const clean = Object.fromEntries(
      Object.entries(positions)
        .map(([k, v]) => [k, v.trim()])
        .filter(([, v]) => v),
    );
    const row = { title: title.trim(), positions: clean, stake: stake.trim() || null, due_date: due || null };
    const { error } = bet
      ? await getSupabase().from("bets").update(row).eq("id", bet.id)
      : await getSupabase().from("bets").insert(row);
    if (error) return setError(error.message);
    if (!bet) notifyPartner("Neue Wette", row.stake ? `${row.title} · Einsatz: ${row.stake}` : row.title, "/wetten");
    onClose();
  }

  async function remove() {
    if (!bet || !window.confirm(`Wette „${bet.title}“ löschen?`)) return;
    await getSupabase().from("bets").delete().eq("id", bet.id);
    onClose();
  }

  return (
    <Modal
      title={bet ? "Wette bearbeiten" : "Neue Wette"}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {bet && <DeleteButton onClick={remove} />}
          <SaveButtons onCancel={onClose} />
        </>
      }
    >
      <input
        autoFocus={!bet}
        required
        placeholder="Worum geht's? z. B. Schnee an Weihnachten"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={`${inputClass} text-base font-medium`}
      />
      {people.map((p) => (
        <Field key={p.id} label={`${p.display_name} sagt`}>
          <input
            value={positions[p.id] ?? ""}
            onChange={(e) => setPositions((s) => ({ ...s, [p.id]: e.target.value }))}
            className={inputClass}
          />
        </Field>
      ))}
      <Field label="Einsatz (optional)">
        <input placeholder="z. B. Verlierer zahlt das Essen" value={stake} onChange={(e) => setStake(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Wird entschieden am (optional)">
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

function ResolveDialog({
  bet,
  people,
  personColor,
  onClose,
  onPaid,
}: {
  bet: Bet;
  people: Person[];
  personColor: (id: string | null) => string;
  onClose: () => void;
  onPaid: (b: Bet, paid: boolean) => Promise<void>;
}) {
  const initial = bet.is_draw ? "draw" : (bet.winner_id ?? "");
  const [choice, setChoice] = useState<string>(initial);

  async function save() {
    if (!choice) return;
    await getSupabase()
      .from("bets")
      .update({
        winner_id: choice === "draw" ? null : choice,
        is_draw: choice === "draw",
        resolved_at: bet.resolved_at ?? new Date().toISOString(),
      })
      .eq("id", bet.id);
    if (!bet.resolved_at) {
      const result = choice === "draw" ? "Unentschieden" : `${people.find((p) => p.id === choice)?.display_name} gewinnt`;
      notifyPartner("Wette aufgelöst", `${bet.title}: ${result}`, "/wetten");
    }
    onClose();
  }

  async function reopen() {
    await getSupabase()
      .from("bets")
      .update({ winner_id: null, is_draw: false, resolved_at: null, stake_paid: false })
      .eq("id", bet.id);
    onClose();
  }

  const options = [
    ...people.map((p) => ({ value: p.id, label: `${p.display_name} gewinnt`, color: personColor(p.id) })),
    { value: "draw", label: "Unentschieden", color: "#71717a" },
  ];

  return (
    <Modal
      title={bet.title}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {bet.resolved_at && (
            <button type="button" onClick={reopen} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-foreground/5">
              Wieder öffnen
            </button>
          )}
          <SaveButtons onCancel={onClose} />
        </>
      }
    >
      <div className="space-y-1">
        {people.map((p) =>
          bet.positions?.[p.id] ? (
            <p key={p.id} className="text-sm">
              <span className="font-medium">{p.display_name}:</span> <span className="text-muted">{bet.positions[p.id]}</span>
            </p>
          ) : null,
        )}
        {bet.stake && <p className="text-sm text-muted">Einsatz: {bet.stake}</p>}
      </div>
      <div className="grid gap-2">
        {options.map((o) => {
          const active = choice === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setChoice(o.value)}
              style={active ? { borderColor: o.color, backgroundColor: `${o.color}1f` } : undefined}
              className={`rounded-lg border px-3 py-2.5 text-left text-sm ${active ? "font-medium" : "border-border text-muted"}`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {bet.resolved_at && bet.stake && !bet.is_draw && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            defaultChecked={bet.stake_paid}
            onChange={(e) => onPaid(bet, e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Einsatz eingelöst
        </label>
      )}
    </Modal>
  );
}
