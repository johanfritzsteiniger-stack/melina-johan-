"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type { Entry } from "@/lib/crossword/generate";

export type PuzzleRow = {
  id: string;
  date: string;
  rows: number;
  cols: number;
  entries: Entry[];
  started_at: string | null;
  solved_at: string | null;
  hints_used: number;
};

export type CellRow = {
  puzzle_id: string;
  r: number;
  c: number;
  letter: string;
  revealed: boolean;
  by: string | null;
};

export type Cursor = { userId: string; r: number; c: number; dir: "a" | "d" };

export const PUZZLE_COLUMNS = "id, date, rows, cols, entries, started_at, solved_at, hints_used";
const MIGRATION_HINT =
  "Das Rätsel ist noch nicht eingerichtet. Bitte 0008_crossword.sql und 0009_crossword_words.sql im SQL Editor ausführen.";

export const key = (r: number, c: number) => `${r},${c}`;

/** Umlaute wie im Kreuzworträtsel üblich ausschreiben. */
export function normalizeLetters(input: string): string {
  return input
    .toUpperCase()
    .replace(/Ä/g, "AE")
    .replace(/Ö/g, "OE")
    .replace(/Ü/g, "UE")
    .replace(/ß/g, "SS")
    .replace(/[^A-Z]/g, "");
}

/** Lösung, Nummern und Zuordnung Feld → Einträge. */
export function useGeometry(puzzle: PuzzleRow | null) {
  return useMemo(() => {
    if (!puzzle) return null;
    const solution = new Map<string, string>();
    const numbers = new Map<string, number>();
    const entriesAt = new Map<string, { a?: number; d?: number }>();
    puzzle.entries.forEach((e, idx) => {
      numbers.set(key(e.r, e.c), e.n);
      for (let i = 0; i < e.answer.length; i++) {
        const r = e.r + (e.dir === "d" ? i : 0);
        const c = e.c + (e.dir === "a" ? i : 0);
        solution.set(key(r, c), e.answer[i]);
        entriesAt.set(key(r, c), { ...entriesAt.get(key(r, c)), [e.dir]: idx });
      }
    });
    return { solution, numbers, entriesAt };
  }, [puzzle]);
}

/** Lädt ein Rätsel samt gemeinsamem Spielstand und hält beides live aktuell. */
export function usePuzzle(date: string, isToday: boolean) {
  const [puzzle, setPuzzle] = useState<PuzzleRow | null>(null);
  const [cells, setCells] = useState<Map<string, CellRow>>(new Map());
  const [cursors, setCursors] = useState<Map<string, Cursor>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabase>["channel"]> | null>(null);

  const loadCells = useCallback(async (puzzleId: string) => {
    const { data } = await getSupabase()
      .from("cw_cells")
      .select("puzzle_id, r, c, letter, revealed, by")
      .eq("puzzle_id", puzzleId);
    setCells(new Map(((data ?? []) as CellRow[]).map((x) => [key(x.r, x.c), x])));
  }, []);

  const load = useCallback(
    async (allowCreate: boolean) => {
      const supabase = getSupabase();
      const query = () => supabase.from("cw_puzzles").select(PUZZLE_COLUMNS).eq("date", date).maybeSingle();
      let { data, error } = await query();
      if (error) {
        setError(["42P01", "PGRST205"].includes(error.code) ? MIGRATION_HINT : error.message);
        setLoading(false);
        return;
      }
      if (!data && allowCreate) {
        // Der Zeitplaner war noch nicht da – Rätsel jetzt erzeugen
        const res = await fetch("/api/crossword/ensure", { method: "POST", body: "{}" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? "Das heutige Rätsel konnte nicht erzeugt werden.");
          setLoading(false);
          return;
        }
        ({ data, error } = await query());
      }
      if (!data) {
        setError("Für diesen Tag gibt es kein Rätsel.");
        setLoading(false);
        return;
      }
      setPuzzle(data as PuzzleRow);
      await loadCells(data.id);
      setError(null);
      setLoading(false);
    },
    [date, loadCells],
  );

  useEffect(() => {
    const t = window.setTimeout(() => load(isToday), 0);
    return () => window.clearTimeout(t);
  }, [load, isToday]);

  // Live: Buchstaben, Rätselstatus und Cursor des anderen
  const puzzleId = puzzle?.id;
  useEffect(() => {
    if (!puzzleId) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`cw-${puzzleId}`, { config: { broadcast: { self: false } } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cw_cells", filter: `puzzle_id=eq.${puzzleId}` },
        (payload) => {
          setCells((current) => {
            const next = new Map(current);
            if (payload.eventType === "DELETE") {
              const old = payload.old as Partial<CellRow>;
              if (old.r !== undefined && old.c !== undefined) next.delete(key(old.r, old.c));
            } else {
              const row = payload.new as CellRow;
              next.set(key(row.r, row.c), row);
            }
            return next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "cw_puzzles", filter: `id=eq.${puzzleId}` },
        (payload) => setPuzzle((p) => (p ? { ...p, ...(payload.new as Partial<PuzzleRow>) } : p)),
      )
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const cur = payload as Cursor;
        setCursors((m) => new Map(m).set(cur.userId, cur));
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [puzzleId]);

  const sendCursor = useCallback((cur: Cursor) => {
    channelRef.current?.send({ type: "broadcast", event: "cursor", payload: cur });
  }, []);

  return { puzzle, setPuzzle, cells, setCells, cursors, loading, error, reload: () => load(isToday), sendCursor };
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")} h` : `${m}:${String(sec).padStart(2, "0")} min`;
}
