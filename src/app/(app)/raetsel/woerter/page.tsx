"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Trash2 } from "lucide-react";
import { ErrorBox, inputClass } from "@/components/ui";
import { SkeletonList } from "@/components/skeleton";
import { getSupabase } from "@/lib/supabase/client";
import { useTable } from "@/lib/use-table";
import { deleteWithUndo } from "@/lib/undo";
import { toastError, toastSaved } from "@/lib/toast";
import { normalizeLetters } from "@/lib/crossword/client";

type Word = {
  id: string;
  word: string;
  clue: string;
  active: boolean;
  source: "start" | "eigen";
  last_used: string | null;
};

export default function WoerterPage() {
  const { rows, setRows, loading, error } = useTable<Word>(
    "cw_words",
    "id, word, clue, active, source, last_used",
    [{ column: "word" }],
  );
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"alle" | "eigen" | "aus">("alle");
  const [word, setWord] = useState("");
  const [clue, setClue] = useState("");
  const [limit, setLimit] = useState(50);

  const normalized = normalizeLetters(word);
  const list = useMemo(() => {
    const q = normalizeLetters(query);
    const text = query.trim().toLowerCase();
    return rows.filter(
      (w) =>
        (filter === "alle" || (filter === "eigen" ? w.source === "eigen" : !w.active)) &&
        (!query || w.word.includes(q) || w.clue.toLowerCase().includes(text)),
    );
  }, [rows, query, filter]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (normalized.length < 3 || normalized.length > 13) return toastError("Das Wort muss 3 bis 13 Buchstaben haben.");
    if (!clue.trim()) return toastError("Bitte einen Hinweis eingeben.");
    const { error } = await getSupabase()
      .from("cw_words")
      .upsert({ word: normalized, clue: clue.trim(), source: "eigen", active: true }, { onConflict: "word" });
    if (error) return toastError("Speichern hat nicht geklappt: " + error.message);
    toastSaved(`„${normalized}“ gespeichert`);
    setWord("");
    setClue("");
  }

  async function toggle(w: Word) {
    setRows((r) => r.map((x) => (x.id === w.id ? { ...x, active: !w.active } : x)));
    await getSupabase().from("cw_words").update({ active: !w.active }).eq("id", w.id);
  }

  async function updateClue(w: Word, value: string) {
    if (!value.trim() || value.trim() === w.clue) return;
    const { error } = await getSupabase().from("cw_words").update({ clue: value.trim() }).eq("id", w.id);
    if (error) toastError(error.message);
    else toastSaved("Hinweis gespeichert");
  }

  const own = rows.filter((w) => w.source === "eigen").length;
  const inactive = rows.filter((w) => !w.active).length;

  return (
    <>
      <header className="mb-5 flex items-center gap-3">
        <Link href="/raetsel" className="rounded-lg p-1 text-muted hover:bg-foreground/5" aria-label="Zurück">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wörter</h1>
          <p className="text-sm text-muted">
            {rows.length} Wörter · {own} eigene{inactive ? ` · ${inactive} ausgeschaltet` : ""}
          </p>
        </div>
      </header>

      {error && <ErrorBox text={error} />}

      <form onSubmit={add} className="mb-6 space-y-3 rounded-2xl bg-soft p-4 text-soft-foreground">
        <p className="text-sm font-semibold">Eigenes Wort hinzufügen</p>
        <p className="text-xs opacity-80">
          Zum Beispiel Insider: Wort „Ischgl“, Hinweis „Ort unseres ersten Skiurlaubs“. Umlaute werden automatisch zu AE, OE, UE.
        </p>
        <div className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
          <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="Wort" className={`${inputClass} bg-card`} />
          <input value={clue} onChange={(e) => setClue(e.target.value)} placeholder="Hinweis" className={`${inputClass} bg-card`} />
          <button type="submit" className="flex items-center justify-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground">
            <Plus size={16} /> Hinzufügen
          </button>
        </div>
        {word && <p className="text-xs opacity-80">Wird gespeichert als: {normalized || "–"} ({normalized.length})</p>}
      </form>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen …" className={`${inputClass} pl-9`} />
        </div>
        {(["alle", "eigen", "aus"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm ${filter === f ? "bg-soft font-medium text-soft-foreground" : "bg-card text-muted"}`}
          >
            {f === "alle" ? "Alle" : f === "eigen" ? "Eigene" : "Ausgeschaltet"}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList rows={6} className="h-12" />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
            {list.slice(0, limit).map((w) => (
              <li key={w.id} className={`flex items-center gap-3 px-4 py-2.5 ${w.active ? "" : "opacity-50"}`}>
                <span className="w-32 shrink-0 font-mono text-sm font-semibold tracking-wide">{w.word}</span>
                <input
                  defaultValue={w.clue}
                  onBlur={(e) => updateClue(w, e.target.value)}
                  className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm outline-none focus:bg-background"
                />
                <button
                  onClick={() => toggle(w)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-muted hover:bg-soft"
                  title={w.active ? "Nicht mehr verwenden" : "Wieder verwenden"}
                >
                  {w.active ? "aus" : "an"}
                </button>
                {w.source === "eigen" && (
                  <button
                    onClick={() => deleteWithUndo({ table: "cw_words", ids: [w.id], message: `„${w.word}“ gelöscht` })}
                    className="shrink-0 rounded-md p-1 text-muted hover:text-red-600"
                    aria-label="Löschen"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {list.length > limit && (
            <button onClick={() => setLimit((l) => l + 100)} className="mt-3 w-full rounded-xl bg-card py-2 text-sm text-muted hover:bg-soft">
              Weitere anzeigen ({list.length - limit})
            </button>
          )}
          {list.length === 0 && <p className="text-sm text-muted">Keine Treffer.</p>}
        </>
      )}
    </>
  );
}
