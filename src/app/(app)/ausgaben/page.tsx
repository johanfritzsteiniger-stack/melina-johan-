"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SkeletonList } from "@/components/skeleton";
import { ErrorBox } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { useTable } from "@/lib/use-table";
import { useToday } from "@/lib/use-today";
import { useCalendarMeta, type Person } from "@/lib/use-calendar-meta";
import { formatDate } from "@/lib/calendar";
import { ExpenseDialog } from "@/components/dialogs/expense-dialog";
import { toast } from "@/lib/toast";
import {
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
      // Rückgängig: Abrechnung löschen – die Ausgaben werden dadurch wieder offen
      toast(`Ausgeglichen: ${name(bal.from)} → ${name(bal.to)} ${euro(bal.amount)}`, {
        label: "Rückgängig",
        run: async () => {
          await supabase.from("settlements").delete().eq("id", data.id);
          toast("Wiederhergestellt ✓");
        },
      });
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
      <section className="mb-6 rounded-2xl bg-soft p-5 text-soft-foreground">
        <p className="text-sm opacity-80">Aktueller Stand</p>
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
        <p className="mt-3 text-xs opacity-80">
          {open.length} offene Ausgaben · diesen Monat gesamt {euro(monthTotal)}
        </p>
      </section>

      {/* Offene Ausgaben */}
      {expenses.loading ? (
        <SkeletonList />
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
