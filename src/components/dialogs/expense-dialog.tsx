"use client";

import { useState } from "react";
import { Chips, DeleteButton, Field, Modal, SaveButtons, inputClass } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { useToday } from "@/lib/use-today";
import { useProfiles } from "@/lib/use-profile";
import type { Person } from "@/lib/use-calendar-meta";
import { notifyPartner } from "@/lib/push-client";
import { deleteWithUndo } from "@/lib/undo";
import { toastSaved } from "@/lib/toast";
import { EXPENSE_CATEGORIES, euro, type Expense } from "@/lib/expenses";

export function ExpenseDialog({ expense, people, onClose }: { expense: Expense | null; people: Person[]; onClose: () => void }) {
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
    toastSaved(expense ? "Gespeichert" : "Ausgabe eingetragen");
    onClose();
  }

  async function remove() {
    if (!expense) return;
    const ok = await deleteWithUndo({ table: "expenses", ids: [expense.id], message: `„${expense.title}“ gelöscht` });
    if (!ok) return;
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
