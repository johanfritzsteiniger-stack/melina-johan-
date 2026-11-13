"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import {
  AGGREGATES,
  PERIODS,
  type Aggregate,
  type Battle,
  type Period,
} from "@/lib/battles";

const input =
  "w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent";

export function BattleDialog({
  battle,
  nextSort,
  onClose,
  onSaved,
  onDeleted,
}: {
  battle: Battle | null;
  nextSort: number;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(battle?.name ?? "");
  const [emoji, setEmoji] = useState(battle?.emoji ?? "");
  const [unit, setUnit] = useState(battle?.unit ?? "Punkte");
  const [period, setPeriod] = useState<Period>(battle?.period ?? "week");
  const [agg, setAgg] = useState<Aggregate>(battle?.aggregate ?? "sum");
  const [higherWins, setHigherWins] = useState(battle?.higher_wins ?? true);
  const [archived, setArchived] = useState(battle?.archived ?? false);
  const [endDate, setEndDate] = useState(battle?.end_date ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const row = {
      name: name.trim(),
      emoji: emoji.trim() || null,
      unit: unit.trim() || "Punkte",
      period,
      aggregate: agg,
      higher_wins: higherWins,
      archived,
      end_date: endDate || null,
    };
    const supabase = getSupabase();
    const { data, error } = battle
      ? await supabase.from("battles").update(row).eq("id", battle.id).select("id").single()
      : await supabase.from("battles").insert({ ...row, sort: nextSort }).select("id").single();
    setSaving(false);
    if (error) {
      setError("Speichern hat nicht geklappt: " + error.message);
      return;
    }
    onSaved(data.id as string);
    onClose();
  }

  async function remove() {
    if (!battle) return;
    if (!window.confirm(`Battle „${battle.name}“ mit allen Einträgen endgültig löschen?`)) return;
    const { error } = await getSupabase().from("battles").delete().eq("id", battle.id);
    if (error) {
      setError("Löschen hat nicht geklappt: " + error.message);
      return;
    }
    onDeleted?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="pb-safe max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{battle ? "Battle bearbeiten" : "Neues Battle"}</h2>
          <button type="button" onClick={onClose} className="p-1 text-muted" aria-label="Schließen">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2">
          <input
            placeholder="🏆"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-16 shrink-0 rounded-lg border border-border bg-background px-2 py-2 text-center outline-none focus:border-accent"
            aria-label="Emoji"
          />
          <input
            autoFocus={!battle}
            required
            placeholder="Name, z. B. Schritte"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${input} text-base font-medium`}
          />
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-muted">Einheit</span>
          <input
            placeholder="z. B. Min, km, Schritte"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={input}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-muted">Gewertet wird</span>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={input}>
            {(Object.keys(PERIODS) as Period[]).map((p) => (
              <option key={p} value={p}>
                {PERIODS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-muted">Mehrere Einträge im Zeitraum</span>
          <select value={agg} onChange={(e) => setAgg(e.target.value as Aggregate)} className={input}>
            {(Object.keys(AGGREGATES) as Aggregate[]).map((a) => (
              <option key={a} value={a}>
                {AGGREGATES[a]}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-1">
          <span className="text-sm text-muted">Wer gewinnt?</span>
          <div className="grid grid-cols-2 gap-2">
            {[
              [true, "Mehr gewinnt"],
              [false, "Weniger gewinnt"],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setHigherWins(v as boolean)}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  higherWins === v ? "border-accent bg-accent/10 font-medium" : "border-border text-muted"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>

        <label className="block space-y-1">
          <span className="text-sm text-muted">Enddatum (optional)</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
          <span className="block text-xs text-muted">
            Danach wandert das Battle mit Endstand automatisch ins Archiv. Leer lassen für dauerhafte
            Battles – die bekommen jedes Kalenderjahr eine eigene Saison.
          </span>
        </label>

        {battle && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            Archivieren (beendet, bleibt aber mit Ergebnissen erhalten)
          </label>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          {battle && (
            <button
              type="button"
              onClick={remove}
              className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10"
            >
              Löschen
            </button>
          )}
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-foreground/5">
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {saving ? "Speichern …" : "Speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
