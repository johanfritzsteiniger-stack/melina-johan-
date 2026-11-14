// Nur auf dem Server verwenden.
import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePuzzle, seedFromString, type WordInput } from "@/lib/crossword/generate";

const COOLDOWN_DAYS = 60;

function minusDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Stellt sicher, dass es für das Datum ein Rätsel gibt, und gibt dessen id zurück.
 * Mit replace=true wird ein noch nicht begonnenes Rätsel durch ein neues ersetzt.
 */
export async function ensurePuzzle(
  db: SupabaseClient,
  date: string,
  opts: { replace?: boolean } = {},
): Promise<{ id: string; created: boolean } | { error: string }> {
  const { data: existing } = await db.from("cw_puzzles").select("id, started_at").eq("date", date).maybeSingle();
  if (existing && !opts.replace) return { id: existing.id as string, created: false };
  if (existing && opts.replace) {
    if (existing.started_at) return { error: "Das Rätsel wurde schon begonnen." };
    await db.from("cw_puzzles").delete().eq("id", existing.id);
  }

  // Wörter laden – kürzlich benutzte erst einmal auslassen
  const { data: rows, error } = await db
    .from("cw_words")
    .select("id, word, clue, last_used")
    .eq("active", true)
    .limit(10000);
  if (error) return { error: error.message };
  const all = (rows ?? []) as (WordInput & { last_used: string | null })[];
  const cutoff = minusDays(date, COOLDOWN_DAYS);
  let pool = all.filter((w) => !w.last_used || w.last_used < cutoff);
  if (pool.length < 300) pool = all; // zu wenige frische Wörter: dann alle nehmen
  if (pool.length < 50) return { error: "Zu wenige Wörter – bitte das Wörter-Startpaket (0009) einspielen." };

  const seed = seedFromString(date + (opts.replace ? String(Date.now()) : ""));
  const puzzle = generatePuzzle(pool, { seed, attempts: 25 });

  const { data: inserted, error: insertError } = await db
    .from("cw_puzzles")
    .insert({ date, rows: puzzle.rows, cols: puzzle.cols, entries: puzzle.entries })
    .select("id")
    .single();
  if (insertError) {
    // Gleichzeitig von jemand anderem erzeugt
    const { data: again } = await db.from("cw_puzzles").select("id").eq("date", date).maybeSingle();
    if (again) return { id: again.id as string, created: false };
    return { error: insertError.message };
  }

  await db
    .from("cw_words")
    .update({ last_used: date })
    .in("id", puzzle.entries.map((e) => e.word_id));

  return { id: inserted.id as string, created: true };
}
