"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, ListChecks, RefreshCw, SpellCheck } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { notifyPartner } from "@/lib/push-client";
import { toast, toastError } from "@/lib/toast";
import type { Person } from "@/lib/use-calendar-meta";
import type { Direction, Entry } from "@/lib/crossword/generate";
import {
  formatDuration,
  key,
  normalizeLetters,
  useGeometry,
  usePuzzle,
  type CellRow,
} from "@/lib/crossword/client";

type Sel = { r: number; c: number; dir: Direction };

export function CrosswordBoard({
  date,
  isToday,
  myId,
  people,
  personColor,
}: {
  date: string;
  isToday: boolean;
  myId: string;
  people: Person[];
  personColor: (id: string | null) => string;
}) {
  const { puzzle, setPuzzle, cells, setCells, cursors, loading, error, reload, sendCursor } = usePuzzle(date, isToday);
  const geo = useGeometry(puzzle);
  const [sel, setSel] = useState<Sel | null>(null);
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(32);

  // Feldgröße an die Breite anpassen
  useEffect(() => {
    if (!puzzle || !boardRef.current) return;
    const el = boardRef.current;
    const update = () => setCellSize(Math.max(22, Math.min(44, Math.floor(el.clientWidth / puzzle.cols))));
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [puzzle]);

  const current = useMemo(() => {
    if (!geo || !puzzle || !sel) return null;
    const at = geo.entriesAt.get(key(sel.r, sel.c));
    const idx = at?.[sel.dir] ?? at?.a ?? at?.d;
    return idx === undefined ? null : { idx, entry: puzzle.entries[idx] };
  }, [geo, puzzle, sel]);

  const currentCells = useMemo(() => {
    const set = new Set<string>();
    if (!current) return set;
    const e = current.entry;
    for (let i = 0; i < e.answer.length; i++) set.add(key(e.r + (e.dir === "d" ? i : 0), e.c + (e.dir === "a" ? i : 0)));
    return set;
  }, [current]);

  if (loading) return <div className="skeleton h-80 rounded-2xl" />;
  if (error || !puzzle || !geo) {
    return (
      <div className="rounded-2xl bg-card p-5 text-sm">
        <p className="text-red-600">{error ?? "Rätsel nicht gefunden."}</p>
        <button onClick={reload} className="mt-3 flex items-center gap-1.5 text-muted hover:text-foreground">
          <RefreshCw size={14} /> Erneut versuchen
        </button>
      </div>
    );
  }

  const total = geo.solution.size;
  const filled = [...geo.solution.keys()].filter((k) => cells.get(k)?.letter).length;
  const correct = [...geo.solution.entries()].filter(([k, v]) => cells.get(k)?.letter === v).length;
  const solved = Boolean(puzzle.solved_at);
  const p = puzzle;
  const g = geo;

  // ---------- Auswahl ----------

  function select(r: number, c: number, preferDir?: Direction) {
    const at = g.entriesAt.get(key(r, c));
    if (!at) return;
    let dir: Direction = preferDir ?? sel?.dir ?? "a";
    if (sel && sel.r === r && sel.c === c && !preferDir) {
      // Nochmal tippen: Richtung wechseln
      const other: Direction = sel.dir === "a" ? "d" : "a";
      if (at[other] !== undefined) dir = other;
    }
    if (at[dir] === undefined) dir = dir === "a" ? "d" : "a";
    const next = { r, c, dir };
    setSel(next);
    sendCursor({ userId: myId, ...next });
    inputRef.current?.focus({ preventScroll: true });
  }

  function selectEntry(idx: number) {
    const e = p.entries[idx];
    // Erstes leeres Feld des Wortes, sonst Anfang
    for (let i = 0; i < e.answer.length; i++) {
      const r = e.r + (e.dir === "d" ? i : 0);
      const c = e.c + (e.dir === "a" ? i : 0);
      if (!cells.get(key(r, c))?.letter) return select(r, c, e.dir);
    }
    select(e.r, e.c, e.dir);
  }

  function jumpEntry(delta: number) {
    if (!current) return selectEntry(0);
    const n = p.entries.length;
    selectEntry((current.idx + delta + n) % n);
  }

  // ---------- Schreiben ----------

  async function writeLetter(r: number, c: number, letter: string | null) {
    const k = key(r, c);
    const prev = cells.get(k);
    if (prev?.revealed) return; // Aufgedeckte Buchstaben bleiben
    setWrong((w) => {
      if (!w.has(k)) return w;
      const n = new Set(w);
      n.delete(k);
      return n;
    });
    setCells((m) => {
      const next = new Map(m);
      if (letter) next.set(k, { puzzle_id: p.id, r, c, letter, revealed: false, by: myId });
      else next.delete(k);
      return next;
    });
    const supabase = getSupabase();
    const { error } = letter
      ? await supabase.from("cw_cells").upsert({ puzzle_id: p.id, r, c, letter, revealed: false, by: myId })
      : await supabase.from("cw_cells").delete().match({ puzzle_id: p.id, r, c });
    if (error) {
      toastError("Speichern hat nicht geklappt: " + error.message);
      setCells((m) => {
        const next = new Map(m);
        if (prev) next.set(k, prev);
        else next.delete(k);
        return next;
      });
      return;
    }
    if (letter && !p.started_at) {
      const started = new Date().toISOString();
      setPuzzle((x) => (x ? { ...x, started_at: started } : x));
      await supabase.from("cw_puzzles").update({ started_at: started }).eq("id", p.id).is("started_at", null);
    }
  }

  function typeLetters(text: string) {
    if (!sel || solved) return;
    const letters = normalizeLetters(text);
    let { r, c } = sel;
    for (const ch of letters) {
      if (!g.solution.has(key(r, c))) break;
      writeLetter(r, c, ch);
      const nr = r + (sel.dir === "d" ? 1 : 0);
      const nc = c + (sel.dir === "a" ? 1 : 0);
      if (!g.solution.has(key(nr, nc))) break;
      r = nr;
      c = nc;
    }
    if (r !== sel.r || c !== sel.c) select(r, c, sel.dir);
  }

  function backspace() {
    if (!sel || solved) return;
    const k = key(sel.r, sel.c);
    if (cells.get(k)?.letter && !cells.get(k)?.revealed) {
      writeLetter(sel.r, sel.c, null);
      return;
    }
    const r = sel.r - (sel.dir === "d" ? 1 : 0);
    const c = sel.c - (sel.dir === "a" ? 1 : 0);
    if (g.solution.has(key(r, c))) {
      select(r, c, sel.dir);
      writeLetter(r, c, null);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!sel) return;
    const k = e.key;
    if (k === "Backspace" || k === "Delete") {
      e.preventDefault();
      backspace();
    } else if (k === "ArrowRight" || k === "ArrowLeft" || k === "ArrowUp" || k === "ArrowDown") {
      e.preventDefault();
      const dir: Direction = k === "ArrowRight" || k === "ArrowLeft" ? "a" : "d";
      const delta = k === "ArrowRight" || k === "ArrowDown" ? 1 : -1;
      if (sel.dir !== dir && g.entriesAt.get(key(sel.r, sel.c))?.[dir] !== undefined) {
        select(sel.r, sel.c, dir);
      } else {
        const r = sel.r + (dir === "d" ? delta : 0);
        const c = sel.c + (dir === "a" ? delta : 0);
        if (g.solution.has(key(r, c))) select(r, c, dir);
      }
    } else if (k === "Tab" || k === "Enter") {
      e.preventDefault();
      jumpEntry(e.shiftKey ? -1 : 1);
    } else if (k === " ") {
      e.preventDefault();
      select(sel.r, sel.c);
    } else if (k.length === 1 && /[a-zäöüß]/i.test(k)) {
      e.preventDefault();
      typeLetters(k);
    }
  }

  // Handy-Tastaturen liefern oft nur input-Events
  function onInput(e: React.FormEvent<HTMLInputElement>) {
    const value = e.currentTarget.value;
    e.currentTarget.value = "";
    if (value) typeLetters(value);
  }

  // ---------- Hilfen ----------

  function check() {
    inputRef.current?.focus({ preventScroll: true });
    const bad = new Set<string>();
    for (const [k, v] of g.solution) {
      const cell = cells.get(k);
      if (cell?.letter && cell.letter !== v) bad.add(k);
    }
    setWrong(bad);
    toast(bad.size === 0 ? "Alles bisher richtig ✓" : `${bad.size} ${bad.size === 1 ? "Buchstabe ist" : "Buchstaben sind"} falsch`);
  }

  async function reveal() {
    if (!sel || solved) return;
    inputRef.current?.focus({ preventScroll: true });
    const k = key(sel.r, sel.c);
    const letter = g.solution.get(k)!;
    if (cells.get(k)?.letter === letter) return toast("Der Buchstabe stimmt schon");
    setCells((m) => new Map(m).set(k, { puzzle_id: p.id, r: sel.r, c: sel.c, letter, revealed: true, by: myId }));
    const supabase = getSupabase();
    await supabase.from("cw_cells").upsert({ puzzle_id: p.id, r: sel.r, c: sel.c, letter, revealed: true, by: myId });
    const hints = p.hints_used + 1;
    setPuzzle((x) => (x ? { ...x, hints_used: hints } : x));
    await supabase.from("cw_puzzles").update({ hints_used: hints }).eq("id", p.id);
    if (!p.started_at) {
      await supabase.from("cw_puzzles").update({ started_at: new Date().toISOString() }).eq("id", p.id).is("started_at", null);
    }
  }

  async function newPuzzle() {
    const res = await fetch("/api/crossword/ensure", { method: "POST", body: JSON.stringify({ replace: true }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return toastError(body.error ?? "Hat nicht geklappt.");
    toast("Neues Rätsel erzeugt");
    setSel(null);
    reload();
  }

  return (
    <div className="space-y-4">
      <SolvedWatcher
        puzzleId={p.id}
        solved={solved}
        allCorrect={correct === total}
        startedAt={p.started_at}
        hints={p.hints_used}
        onSolved={(at) => setPuzzle((x) => (x ? { ...x, solved_at: at } : x))}
      />

      {/* Status */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {solved ? (
          <span className="rounded-full bg-soft px-3 py-1 font-medium text-soft-foreground">
            Gelöst{p.started_at && ` in ${formatDuration(new Date(p.solved_at!).getTime() - new Date(p.started_at).getTime())}`}
            {p.hints_used > 0 && ` · ${p.hints_used} ${p.hints_used === 1 ? "Hilfe" : "Hilfen"}`}
          </span>
        ) : (
          <span className="text-muted">
            {filled} / {total} Felder · {p.entries.length} Wörter
            {p.hints_used > 0 && ` · ${p.hints_used} ${p.hints_used === 1 ? "Hilfe" : "Hilfen"}`}
          </span>
        )}
        <Contributions cells={cells} people={people} personColor={personColor} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          {/* Aktueller Hinweis */}
          <div className="flex items-center gap-2 rounded-2xl bg-soft p-3 text-soft-foreground">
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => jumpEntry(-1)} className="rounded-lg p-1 hover:bg-black/5" aria-label="Vorheriges Wort">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => sel && select(sel.r, sel.c)} className="min-w-0 flex-1 text-left text-sm">
              {current ? (
                <>
                  <span className="font-semibold">
                    {current.entry.n}
                    {current.entry.dir === "a" ? " waagerecht" : " senkrecht"}
                  </span>{" "}
                  · {current.entry.clue}{" "}
                  <span className="opacity-70">({current.entry.answer.length})</span>
                </>
              ) : (
                <span className="opacity-80">Feld antippen, um loszulegen</span>
              )}
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => jumpEntry(1)} className="rounded-lg p-1 hover:bg-black/5" aria-label="Nächstes Wort">
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Raster */}
          <div ref={boardRef} className="relative w-full min-w-0 overflow-hidden">
            <div
              className="mx-auto grid select-none pt-px pl-px"
              style={{
                gridTemplateColumns: `repeat(${p.cols}, ${cellSize}px)`,
                width: p.cols * cellSize + 1,
              }}
            >
              {Array.from({ length: p.rows * p.cols }, (_, i) => {
                const r = Math.floor(i / p.cols);
                const c = i % p.cols;
                const k = key(r, c);
                if (!g.solution.has(k)) return <div key={k} style={{ height: cellSize }} />;
                const cell = cells.get(k);
                const isSel = sel?.r === r && sel?.c === c;
                const inWord = currentCells.has(k);
                const partner = [...cursors.values()].find((cur) => cur.userId !== myId && cur.r === r && cur.c === c);
                const num = g.numbers.get(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => select(r, c)}
                    className={`relative -mt-px -ml-px border border-[#d9c4b2] dark:border-[#5a4537] ${
                      isSel ? "bg-accent/35" : inWord ? "bg-soft" : "bg-card"
                    } ${wrong.has(k) ? "bg-red-500/20" : ""}`}
                    style={{
                      height: cellSize,
                      outline: partner ? `2px solid ${personColor(partner.userId)}` : undefined,
                      outlineOffset: -2,
                      zIndex: partner || isSel ? 1 : undefined,
                    }}
                    aria-label={`Feld ${r + 1}/${c + 1}`}
                  >
                    {num && (
                      <span className="absolute top-0 left-0.5 leading-none text-muted" style={{ fontSize: Math.max(8, cellSize * 0.28) }}>
                        {num}
                      </span>
                    )}
                    <span
                      className={`font-semibold ${cell?.revealed ? "italic" : ""} ${wrong.has(k) ? "text-red-600" : ""}`}
                      style={{
                        fontSize: cellSize * 0.55,
                        color: wrong.has(k) ? undefined : cell ? personColor(cell.by) : undefined,
                      }}
                    >
                      {cell?.letter ?? ""}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Unsichtbares Eingabefeld für die Tastatur */}
            <input
              ref={inputRef}
              onKeyDown={onKeyDown}
              onInput={onInput}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              aria-label="Buchstaben eingeben"
              className="pointer-events-none absolute top-0 left-0 h-px w-px opacity-0"
              style={{ fontSize: 16 }}
            />
          </div>

          {/* Werkzeuge */}
          <div className="flex flex-wrap gap-2">
            <button onMouseDown={(e) => e.preventDefault()} onClick={check} disabled={solved} className="flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-sm hover:bg-soft disabled:opacity-50">
              <SpellCheck size={16} /> Prüfen
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={reveal} disabled={!sel || solved} className="flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-sm hover:bg-soft disabled:opacity-50">
              <Eye size={16} /> Buchstabe aufdecken
            </button>
            {isToday && !p.started_at && (
              <button onClick={newPuzzle} className="flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-sm text-muted hover:bg-soft">
                <RefreshCw size={16} /> Anderes Rätsel
              </button>
            )}
          </div>
        </div>

        {/* Hinweise */}
        <aside className="space-y-4">
          {(["a", "d"] as const).map((dir) => (
            <section key={dir} className="rounded-2xl bg-card p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <ListChecks size={16} className="text-accent" />
                {dir === "a" ? "Waagerecht" : "Senkrecht"}
              </h3>
              <ul className="space-y-1">
                {p.entries.map((e, idx) =>
                  e.dir !== dir ? null : (
                    <ClueRow
                      key={idx}
                      e={e}
                      active={current?.idx === idx}
                      complete={isComplete(e, cells)}
                      onClick={() => selectEntry(idx)}
                    />
                  ),
                )}
              </ul>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}

function isComplete(e: Entry, cells: Map<string, CellRow>) {
  for (let i = 0; i < e.answer.length; i++) {
    if (!cells.get(key(e.r + (e.dir === "d" ? i : 0), e.c + (e.dir === "a" ? i : 0)))?.letter) return false;
  }
  return true;
}

function ClueRow({ e, active, complete, onClick }: { e: Entry; active: boolean; complete: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full gap-2 rounded-lg px-2 py-1 text-left text-sm ${active ? "bg-soft text-soft-foreground" : "hover:bg-foreground/5"} ${
          complete && !active ? "text-muted" : ""
        }`}
      >
        <span className="w-5 shrink-0 text-right font-semibold">{e.n}</span>
        <span className={`flex-1 ${complete && !active ? "line-through decoration-1" : ""}`}>
          {e.clue} <span className="text-muted">({e.answer.length})</span>
        </span>
      </button>
    </li>
  );
}

function Contributions({
  cells,
  people,
  personColor,
}: {
  cells: Map<string, CellRow>;
  people: Person[];
  personColor: (id: string | null) => string;
}) {
  const counts = new Map<string, number>();
  for (const c of cells.values()) if (c.by && !c.revealed) counts.set(c.by, (counts.get(c.by) ?? 0) + 1);
  const sum = [...counts.values()].reduce((a, b) => a + b, 0);
  if (sum === 0) return null;
  return (
    <span className="flex items-center gap-3 text-muted">
      {people.map((p) => (
        <span key={p.id} className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: personColor(p.id) }} />
          {p.display_name} {Math.round(((counts.get(p.id) ?? 0) / sum) * 100)} %
        </span>
      ))}
    </span>
  );
}

/** Markiert das Rätsel als gelöst, sobald alles stimmt (nur einmal). */
function SolvedWatcher({
  puzzleId,
  solved,
  allCorrect,
  startedAt,
  hints,
  onSolved,
}: {
  puzzleId: string;
  solved: boolean;
  allCorrect: boolean;
  startedAt: string | null;
  hints: number;
  onSolved: (at: string) => void;
}) {
  const done = useRef(false);
  useEffect(() => {
    if (solved || !allCorrect || done.current) return;
    done.current = true;
    const at = new Date().toISOString();
    onSolved(at);
    getSupabase()
      .from("cw_puzzles")
      .update({ solved_at: at })
      .eq("id", puzzleId)
      .is("solved_at", null)
      .select("id")
      .then(({ data }) => {
        if (!data?.length) return; // Der andere war schneller
        const time = startedAt ? formatDuration(new Date(at).getTime() - new Date(startedAt).getTime()) : "";
        toast(`Gelöst! ${time}`);
        notifyPartner("Kreuzworträtsel gelöst 🎉", `${time}${hints ? ` · ${hints} Hilfen` : ""}`, "/raetsel");
      });
  }, [solved, allCorrect, puzzleId, startedAt, hints, onSolved]);
  return null;
}
