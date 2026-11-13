"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Chips, DeleteButton, ErrorBox, Field, Modal, SaveButtons, inputClass } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { useTable } from "@/lib/use-table";
import { useToday } from "@/lib/use-today";
import { useCalendarMeta, type Person } from "@/lib/use-calendar-meta";
import { useProfiles } from "@/lib/use-profile";
import { formatDate } from "@/lib/calendar";
import { notifyPartner } from "@/lib/push-client";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_COLUMNS,
  SETTLEMENT_COLUMNS,
  balance,
  euro,
  type Expense,
  type Settlement,
} from "@/lib/expenses";

export default function AusgabenPage() {
  const expenses = useTable<Expense>("expenses", EXPENSE_COLUMNS, [
    { column: "date", ascending: false },
    { column: "created_at", ascending: false },
  ]);
  const settlements = useTable<Settlement>("settlements", SETTLEMENT_COLUMNS, [{ column: "created_at", ascending: false }]);
  const meta = useCalendarMeta();
  const today = useToday();
  const [edit, setEdit] = useState<{ expense: Expense | null } | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [openSettlement, setOpenSettlement] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ids = useMemo(() => meta.people.map((p) => p.id), [meta.people]);
  const rows = expenses.rows.map((e) => ({ ...e, amount: Number(e.amount) }));
  const open = rows.filter((e) => !e.settlement_id);
  const bal = balance(open, ids);
  const name = (id: string | null) => meta.people.find((p) => p.id === id)?.display_name ?? "?";

  const monthTotal = today
    ? rows.filter((e) => e.date.slice(0, 7) === today.slice(0, 7)).reduce((s, e) => s + e.amount, 0)
    : 0;

  async function settle() {
    if (!bal) return;
    if (!window.confirm(`${name(bal.from)} zahlt ${name(bal.to)} ${euro(bal.amount)}. Danach wandern alle offenen Ausgaben ins Archiv. Ausgleichen?`))
      return;
    setBusy(true);
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("settlements")
      .insert({ from_id: bal.from, to_id: bal.to, amount: bal.amount })
      .select("id")
      .single();
    if (!error && data) {
      await supabase
        .from("expenses")
        .update({ settlement_id: data.id })
        .in("id", open.map((e) => e.id));
    }
    setBusy(false);
  }

  const error = expenses.error ?? settlements.error;

  return (
    <>
      <PageHeader
        title="Ausgaben"
        action={
          <button
            onClick={() => setEdit({ expense: null })}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Ausgabe</span>
          </button>
        }
      />

      {error && <ErrorBox text={error} />}

      {/* Saldo */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted">Aktueller Stand</p>
        {bal ? (
          <>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold">
              <span style={{ color: meta.personColor(bal.from) }}>{name(bal.from)}</span>
              <ArrowRight size={18} className="text-muted" />
              <span style={{ color: meta.personColor(bal.to) }}>{name(bal.to)}</span>
              <span className="tabular-nums">{euro(bal.amount)}</span>
            </p>
            <button
              onClick={settle}
              disabled={busy}
              className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
            >
              Ausgleichen
            </button>
          </>
        ) : (
          <p className="mt-1 text-xl font-semibold">Ihr seid quitt</p>
        )}
        <p className="mt-3 text-xs text-muted">
          {open.length} offene Ausgaben · diesen Monat gesamt {euro(monthTotal)}
        </p>
      </section>

      {/* Offene Ausgaben */}
      {expenses.loading ? (
        <p className="text-sm text-muted">Lädt …</p>
      ) : open.length === 0 && !error ? (
        <button
          onClick={() => setEdit({ expense: null })}
          className="w-full rounded-2xl border border-dashed border-border p-8 text-sm text-muted hover:border-accent/50"
        >
          Keine offenen Ausgaben – z. B. den letzten Einkauf eintragen
        </button>
      ) : (
        <ExpenseList expenses={open} people={meta.people} personColor={meta.personColor} onOpen={(e) => setEdit({ expense: e })} />
      )}

      {/* Archiv */}
      {settlements.rows.length > 0 && (
        <section className="mt-10">
          <button onClick={() => setShowArchive((s) => !s)} className="flex items-center gap-2 text-lg font-semibold">
            {showArchive ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            Abrechnungen <span className="text-sm font-normal text-muted">({settlements.rows.length})</span>
          </button>
          {showArchive && (
            <ul className="mt-3 space-y-2">
              {settlements.rows.map((s) => {
                const items = rows.filter((e) => e.settlement_id === s.id);
                const total = items.reduce((sum, e) => sum + e.amount, 0);
                const isOpen = openSettlement === s.id;
                return (
                  <li key={s.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    <button
                      onClick={() => setOpenSettlement(isOpen ? null : s.id)}
                      className="flex w-full items-center gap-3 p-4 text-left hover:bg-foreground/5"
                    >
                      {isOpen ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {formatDate(s.created_at.slice(0, 10), { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                        <span className="block text-xs text-muted">
                          {items.length} Ausgaben · zusammen {euro(total)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right text-sm">
                        {name(s.from_id)} → {name(s.to_id)}
                        <span className="block font-medium tabular-nums">{euro(Number(s.amount))}</span>
                      </span>
                    </button>
                    {isOpen && items.length > 0 && (
                      <div className="border-t border-border">
                        <ExpenseList expenses={items} people={meta.people} personColor={meta.personColor} flat />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {edit && <ExpenseDialog expense={edit.expense} people={meta.people} onClose={() => setEdit(null)} />}
    </>
  );
}

function splitText(e: Expense, people: Person[]): string {
  const payer = people.find((p) => p.id === e.paid_by)?.display_name ?? "?";
  const other = people.find((p) => p.id !== e.paid_by)?.display_name ?? "?";
  if (e.payer_share === 50) return `${payer} hat bezahlt · halbe-halbe`;
  if (e.payer_share === 100) return `${payer} hat bezahlt · nur für ${payer}`;
  if (e.payer_share === 0) return `${payer} hat bezahlt · nur für ${other}`;
  return `${payer} hat bezahlt · ${e.payer_share} / ${100 - e.payer_share} %`;
}

function ExpenseList({
  expenses,
  people,
  personColor,
  onOpen,
  flat,
}: {
  expenses: Expense[];
  people: Person[];
  personColor: (id: string | null) => string;
  onOpen?: (e: Expense) => void;
  flat?: boolean;
}) {
  return (
    <ul className={`divide-y divide-border ${flat ? "" : "overflow-hidden rounded-2xl border border-border bg-card"}`}>
      {expenses.map((e) => (
        <li key={e.id}>
          <button
            onClick={() => onOpen?.(e)}
            disabled={!onOpen}
            className="flex w-full items-center gap-3 p-4 text-left enabled:hover:bg-foreground/5"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: personColor(e.paid_by) }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{e.title}</span>
              <span className="block truncate text-xs text-muted">
                {formatDate(e.date)} · {splitText(e, people)}
                {e.category && ` · ${e.category}`}
              </span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{euro(Number(e.amount))}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ExpenseDialog({ expense, people, onClose }: { expense: Expense | null; people: Person[]; onClose: () => void }) {
  const today = useToday();
  const { me } = useProfiles();
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount).replace(".", ",") : "");
  const [paidBy, setPaidBy] = useState<string | null>(expense?.paid_by ?? null);
  const [share, setShare] = useState(expense?.payer_share ?? 50);
  const [date, setDate] = useState(expense?.date ?? today);
  const [category, setCategory] = useState(expense?.category ?? "");
  const [error, setError] = useState<string | null>(null);

  const payer = paidBy ?? me?.id ?? people[0]?.id ?? null;
  const payerName = people.find((p) => p.id === payer)?.display_name ?? "?";
  const otherName = people.find((p) => p.id !== payer)?.display_name ?? "?";

  async function save() {
    // "12,50", "1.234,50" oder "12.50"
    const raw = amount.trim();
    const num = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
    if (!title.trim() || !payer || !(num > 0)) {
      setError("Bitte Titel und einen Betrag größer 0 eingeben.");
      return;
    }
    const row = {
      title: title.trim(),
      amount: Math.round(num * 100) / 100,
      paid_by: payer,
      payer_share: share,
      date: date || today,
      category: category || null,
    };
    const { error } = expense
      ? await getSupabase().from("expenses").update(row).eq("id", expense.id)
      : await getSupabase().from("expenses").insert(row);
    if (error) return setError(error.message);
    if (!expense) notifyPartner("Neue Ausgabe", `${row.title} · ${euro(row.amount)}`, "/ausgaben");
    onClose();
  }

  async function remove() {
    if (!expense || !window.confirm(`„${expense.title}“ löschen?`)) return;
    await getSupabase().from("expenses").delete().eq("id", expense.id);
    onClose();
  }

  return (
    <Modal
      title={expense ? "Ausgabe bearbeiten" : "Neue Ausgabe"}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {expense && <DeleteButton onClick={remove} />}
          <SaveButtons onCancel={onClose} />
        </>
      }
    >
      <div className="flex gap-2">
        <input
          autoFocus={!expense}
          required
          placeholder="Wofür?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} text-base font-medium`}
        />
        <div className="relative w-32 shrink-0">
          <input
            required
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            className={`${inputClass} pr-7 text-right text-base font-medium`}
          />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted">€</span>
        </div>
      </div>

      <Field label="Bezahlt von">
        <div className="grid grid-cols-2 gap-2">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPaidBy(p.id)}
              className={`rounded-lg border px-3 py-2 text-sm ${payer === p.id ? "border-accent bg-accent/10 font-medium" : "border-border text-muted"}`}
            >
              {p.display_name}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Für wen?">
        <div className="grid grid-cols-3 gap-2">
          {[
            [50, "Für beide"],
            [100, `Nur ${payerName}`],
            [0, `Nur ${otherName}`],
          ].map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setShare(v as number)}
              className={`truncate rounded-lg border px-2 py-2 text-sm ${share === v ? "border-accent bg-accent/10 font-medium" : "border-border text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Datum">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </Field>

      <Field label="Kategorie (optional)">
        <Chips
          options={[{ value: "", label: "Keine" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]}
          value={category}
          onChange={setCategory}
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
