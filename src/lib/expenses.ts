export type Expense = {
  id: string;
  title: string;
  amount: number;
  paid_by: string;
  payer_share: number; // Anteil (%) der zahlenden Person
  date: string;
  category: string | null;
  settlement_id: string | null;
  created_at: string;
};

export type Settlement = {
  id: string;
  from_id: string | null;
  to_id: string | null;
  amount: number;
  created_at: string;
};

export const EXPENSE_COLUMNS =
  "id, title, amount, paid_by, payer_share, date, category, settlement_id, created_at";
export const SETTLEMENT_COLUMNS = "id, from_id, to_id, amount, created_at";

export const EXPENSE_CATEGORIES = ["Lebensmittel", "Essen gehen", "Haushalt", "Freizeit", "Reise", "Sonstiges"];

export function euro(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/** Wie viel die andere Person für diese Ausgabe schuldet. */
export function owedByOther(e: Expense): number {
  return (Number(e.amount) * (100 - e.payer_share)) / 100;
}

/**
 * Saldo zwischen zwei Personen aus offenen Ausgaben.
 * Ergebnis: wer wem wie viel schuldet (gerundet auf Cent), oder null wenn quitt.
 */
export function balance(
  expenses: Expense[],
  personIds: string[],
): { from: string; to: string; amount: number } | null {
  if (personIds.length < 2) return null;
  const [a, b] = personIds;
  let net = 0; // > 0: b schuldet a
  for (const e of expenses) {
    if (e.settlement_id) continue;
    const owed = owedByOther(e);
    if (e.paid_by === a) net += owed;
    else if (e.paid_by === b) net -= owed;
  }
  const cents = Math.round(net * 100) / 100;
  if (Math.abs(cents) < 0.01) return null;
  return cents > 0 ? { from: b, to: a, amount: cents } : { from: a, to: b, amount: -cents };
}
