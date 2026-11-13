"use client";

import { getSupabase } from "@/lib/supabase/client";
import { toast, toastError } from "@/lib/toast";

type Row = Record<string, unknown>;

/**
 * Abhängige Daten, die beim Rückgängig-Machen wiederhergestellt werden:
 * - "restore": werden mitgelöscht (on delete cascade) und neu eingefügt
 * - "relink":  verlieren nur den Verweis (on delete set null) und bekommen ihn zurück
 */
export type Dependent = { table: string; fk: string; mode: "restore" | "relink" };

/**
 * Löscht sofort und zeigt "Gelöscht – Rückgängig".
 * Vor dem Löschen werden die kompletten Zeilen gesichert.
 */
export async function deleteWithUndo(opts: {
  table: string;
  ids: string[];
  message: string;
  dependents?: Dependent[];
  onUndone?: () => void;
}): Promise<boolean> {
  const { table, ids, message, dependents = [], onUndone } = opts;
  if (ids.length === 0) return false;
  const supabase = getSupabase();

  const { data: rows, error: readError } = await supabase.from(table).select("*").in("id", ids);
  if (readError) {
    toastError("Löschen hat nicht geklappt: " + readError.message);
    return false;
  }

  const saved: { dep: Dependent; rows: Row[] }[] = [];
  for (const dep of dependents) {
    const { data } = await supabase.from(dep.table).select("*").in(dep.fk, ids);
    saved.push({ dep, rows: (data ?? []) as Row[] });
  }

  const { error } = await supabase.from(table).delete().in("id", ids);
  if (error) {
    toastError("Löschen hat nicht geklappt: " + error.message);
    return false;
  }

  toast(message, {
    label: "Rückgängig",
    run: async () => {
      const { error: e1 } = await supabase.from(table).insert(rows as Row[]);
      if (e1) return toastError("Wiederherstellen hat nicht geklappt: " + e1.message);
      for (const { dep, rows: depRows } of saved) {
        if (depRows.length === 0) continue;
        if (dep.mode === "restore") {
          await supabase.from(dep.table).insert(depRows);
        } else {
          // Verweise zurücksetzen, gruppiert nach ursprünglichem Ziel
          const byTarget = new Map<string, string[]>();
          for (const r of depRows) {
            const target = r[dep.fk] as string;
            byTarget.set(target, [...(byTarget.get(target) ?? []), r.id as string]);
          }
          for (const [target, depIds] of byTarget) {
            await supabase.from(dep.table).update({ [dep.fk]: target }).in("id", depIds);
          }
        }
      }
      toast("Wiederhergestellt ✓");
      onUndone?.();
    },
  });
  return true;
}
