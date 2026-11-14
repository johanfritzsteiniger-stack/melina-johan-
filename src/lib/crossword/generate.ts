// Erzeugt ein freies Kreuzworträtsel (Wörter kreuzen sich, Raster max. size × size).
// Rein und ohne Datenbank – damit testbar und auf dem Server wie im Browser nutzbar.

export type WordInput = { id: string; word: string; clue: string };
export type Direction = "a" | "d"; // a = waagerecht, d = senkrecht

export type Entry = {
  n: number;
  dir: Direction;
  r: number;
  c: number;
  answer: string;
  clue: string;
  word_id: string;
};

export type Puzzle = { rows: number; cols: number; entries: Entry[] };

type Placed = { w: WordInput; r: number; c: number; dir: Direction };

/** Kleiner deterministischer Zufallsgenerator (gleicher Seed = gleiches Rätsel). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

class Grid {
  cells: (string | null)[][];
  /** Welche Richtungen ein Feld schon belegen (1 = waagerecht, 2 = senkrecht) */
  dirs: number[][];
  size: number;
  constructor(size: number) {
    this.size = size;
    this.cells = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
    this.dirs = Array.from({ length: size }, () => Array<number>(size).fill(0));
  }
  get(r: number, c: number) {
    return r < 0 || c < 0 || r >= this.size || c >= this.size ? null : this.cells[r][c];
  }

  /** Anzahl Kreuzungen bei gültiger Platzierung, sonst -1. */
  check(word: string, r: number, c: number, dir: Direction): number {
    const dr = dir === "d" ? 1 : 0;
    const dc = dir === "a" ? 1 : 0;
    const endR = r + dr * (word.length - 1);
    const endC = c + dc * (word.length - 1);
    if (r < 0 || c < 0 || endR >= this.size || endC >= this.size) return -1;
    // Vor dem Anfang und nach dem Ende muss frei sein
    if (this.get(r - dr, c - dc) !== null || this.get(endR + dr, endC + dc) !== null) return -1;
    let crossings = 0;
    for (let i = 0; i < word.length; i++) {
      const rr = r + dr * i;
      const cc = c + dc * i;
      const existing = this.cells[rr][cc];
      if (existing !== null) {
        if (existing !== word[i]) return -1;
        // Ein Feld darf nur von einem Wort pro Richtung genutzt werden
        if (this.dirs[rr][cc] & (dir === "a" ? 1 : 2)) return -1;
        crossings++;
      } else {
        // Neue Buchstaben dürfen keine Nachbarn quer zur Richtung haben
        if (this.get(rr + dc, cc + dr) !== null || this.get(rr - dc, cc - dr) !== null) return -1;
      }
    }
    if (crossings === word.length) return -1; // komplett überdeckt
    return crossings;
  }

  place(word: string, r: number, c: number, dir: Direction) {
    for (let i = 0; i < word.length; i++) {
      const rr = r + (dir === "d" ? i : 0);
      const cc = c + (dir === "a" ? i : 0);
      this.cells[rr][cc] = word[i];
      this.dirs[rr][cc] |= dir === "a" ? 1 : 2;
    }
  }
}

function attempt(words: WordInput[], size: number, target: number, rand: () => number) {
  const grid = new Grid(size);
  const placed: Placed[] = [];
  const used = new Set<string>();

  // Startwort: lang, waagerecht, mittig
  const starters = words.filter((w) => w.word.length >= 8 && w.word.length <= size - 2);
  const first = starters[Math.floor(rand() * starters.length)] ?? words[0];
  const r0 = Math.floor(size / 2);
  const c0 = Math.floor((size - first.word.length) / 2);
  grid.place(first.word, r0, c0, "a");
  placed.push({ w: first, r: r0, c: c0, dir: "a" });
  used.add(first.word);

  // Buchstabe → Positionen im Raster (für schnelle Suche)
  const positions = () => {
    const map = new Map<string, [number, number][]>();
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) {
        const ch = grid.cells[r][c];
        if (ch) map.set(ch, [...(map.get(ch) ?? []), [r, c]]);
      }
    return map;
  };

  // Längere Wörter bevorzugen (anspruchsvoller), aber gemischt
  const pool = shuffle(words, rand).sort(
    (a, b) => b.word.length + rand() * 6 - (a.word.length + rand() * 6),
  );

  for (let pass = 0; pass < 3 && placed.length < target; pass++) {
    for (const w of pool) {
      if (placed.length >= target) break;
      if (used.has(w.word) || w.word.length > size) continue;
      const pos = positions();
      let best: { r: number; c: number; dir: Direction; score: number } | null = null;
      for (let i = 0; i < w.word.length; i++) {
        for (const [r, c] of pos.get(w.word[i]) ?? []) {
          for (const dir of ["a", "d"] as const) {
            const sr = dir === "d" ? r - i : r;
            const sc = dir === "a" ? c - i : c;
            const crossings = grid.check(w.word, sr, sc, dir);
            if (crossings < 1) continue;
            // Mehr Kreuzungen und Nähe zur Mitte sind besser
            const center = Math.abs(sr - size / 2) + Math.abs(sc - size / 2);
            const score = crossings * 10 - center * 0.3 + rand();
            if (!best || score > best.score) best = { r: sr, c: sc, dir, score };
          }
        }
      }
      if (best) {
        grid.place(w.word, best.r, best.c, best.dir);
        placed.push({ w, r: best.r, c: best.c, dir: best.dir });
        used.add(w.word);
      }
    }
  }
  return { grid, placed };
}

/** Nummeriert die Einträge wie im Kreuzworträtsel üblich und schneidet das Raster zu. */
function finalize(placed: Placed[], size: number): Puzzle {
  let minR = size, minC = size, maxR = 0, maxC = 0;
  for (const p of placed) {
    const len = p.w.word.length;
    minR = Math.min(minR, p.r);
    minC = Math.min(minC, p.c);
    maxR = Math.max(maxR, p.dir === "d" ? p.r + len - 1 : p.r);
    maxC = Math.max(maxC, p.dir === "a" ? p.c + len - 1 : p.c);
  }
  const starts = [...new Set(placed.map((p) => `${p.r - minR},${p.c - minC}`))]
    .map((k) => k.split(",").map(Number) as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const numberOf = new Map(starts.map(([r, c], i) => [`${r},${c}`, i + 1]));

  const entries: Entry[] = placed
    .map((p) => {
      const r = p.r - minR;
      const c = p.c - minC;
      return { n: numberOf.get(`${r},${c}`)!, dir: p.dir, r, c, answer: p.w.word, clue: p.w.clue, word_id: p.w.id };
    })
    .sort((a, b) => (a.dir === b.dir ? a.n - b.n : a.dir === "a" ? -1 : 1));

  return { rows: maxR - minR + 1, cols: maxC - minC + 1, entries };
}

/**
 * Erzeugt ein Rätsel. Mehrere Versuche, der beste gewinnt
 * (möglichst viele Wörter, viele Kreuzungen, gut gefülltes Raster).
 */
export function generatePuzzle(
  words: WordInput[],
  opts: { size?: number; target?: number; attempts?: number; seed?: number } = {},
): Puzzle {
  const size = opts.size ?? 13;
  const target = opts.target ?? 22;
  const rand = rng(opts.seed ?? Date.now());
  const clean = words.filter((w) => /^[A-Z]{3,13}$/.test(w.word) && w.word.length <= size);
  if (clean.length < 50) throw new Error("Zu wenige Wörter für ein Rätsel");

  let best: { placed: Placed[]; score: number } | null = null;
  for (let i = 0; i < (opts.attempts ?? 40); i++) {
    const { grid, placed } = attempt(clean, size, target, rand);
    let letters = 0;
    for (const row of grid.cells) for (const ch of row) if (ch) letters++;
    const score = placed.length * 100 + letters;
    if (!best || score > best.score) best = { placed, score };
  }
  return finalize(best!.placed, size);
}

/** Lösung als Raster (null = schwarzes Feld). */
export function solutionGrid(p: Puzzle): (string | null)[][] {
  const g = Array.from({ length: p.rows }, () => Array<string | null>(p.cols).fill(null));
  for (const e of p.entries) {
    for (let i = 0; i < e.answer.length; i++) {
      g[e.r + (e.dir === "d" ? i : 0)][e.c + (e.dir === "a" ? i : 0)] = e.answer[i];
    }
  }
  return g;
}
