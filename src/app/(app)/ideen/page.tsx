"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Dices, ExternalLink, MapPin, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SkeletonList } from "@/components/skeleton";
import { Chips, ErrorBox, Field, Modal, SaveButtons, Stars, inputClass } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { useTable } from "@/lib/use-table";
import { useToday } from "@/lib/use-today";
import { formatDate } from "@/lib/calendar";
import { IDEA_COLUMNS as COLUMNS, IDEA_KINDS as KINDS, IdeaDialog, type Idea, type IdeaKind as Kind } from "@/components/dialogs/idea-dialog";
import { toastSaved } from "@/lib/toast";

export default function IdeenPage() {
  const { rows, loading, error } = useTable<Idea>("ideas", COLUMNS, [{ column: "created_at", ascending: false }]);
  const [filter, setFilter] = useState<Kind | "alle">("alle");
  const [edit, setEdit] = useState<{ idea: Idea | null } | null>(null);
  const [doneFor, setDoneFor] = useState<Idea | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [pick, setPick] = useState<Idea | null>(null);

  const matches = (i: Idea) => filter === "alle" || i.kind === filter;
  const open = rows.filter((i) => !i.done_at && matches(i));
  const done = rows
    .filter((i) => i.done_at && matches(i))
    .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  function random() {
    if (open.length === 0) return;
    setPick(open[Math.floor(Math.random() * open.length)]);
  }

  return (
    <>
      <PageHeader
        title="Ideen"
        action={
          <div className="flex gap-2">
            <button
              onClick={random}
              disabled={open.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-foreground/5 disabled:opacity-50"
              title="Zufällige Idee"
            >
              <Dices size={18} />
              <span className="hidden sm:inline">Zufall</span>
            </button>
            <button
              onClick={() => setEdit({ idea: null })}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Idee</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBox text={error} />}

      <div className="mb-5">
        <Chips
          options={[
            { value: "alle" as const, label: "Alle" },
            ...(Object.keys(KINDS) as Kind[]).map((k) => ({ value: k, label: `${KINDS[k].emoji} ${KINDS[k].label}` })),
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {pick && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <Dices size={20} className="text-accent" />
          <span className="flex-1">
            Wie wäre es mit: <strong>{pick.title}</strong>
            {pick.location && <span className="text-muted"> · {pick.location}</span>}
          </span>
          <button onClick={random} className="text-sm text-muted hover:text-foreground">
            Nochmal
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonList />
      ) : open.length === 0 && !error ? (
        <button
          onClick={() => setEdit({ idea: null })}
          className="w-full rounded-2xl border border-dashed border-border p-8 text-sm text-muted hover:border-accent/50"
        >
          Noch keine offenen Ideen – z. B. ein Restaurant, das ihr ausprobieren wollt
        </button>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {open.map((i) => (
            <li key={i.id} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
              <button onClick={() => setEdit({ idea: i })} className="min-w-0 flex-1 text-left">
                <span className="block font-medium">
                  {KINDS[i.kind].emoji} {i.title}
                </span>
                {i.location && (
                  <span className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <MapPin size={12} /> {i.location}
                  </span>
                )}
                {i.note && <span className="mt-1 block text-sm text-muted">{i.note}</span>}
              </button>
              <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                <button
                  onClick={() => setDoneFor(i)}
                  className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:border-accent hover:text-accent"
                >
                  <Check size={14} /> Gemacht
                </button>
                {i.link && (
                  <a href={i.link} target="_blank" rel="noreferrer" className="text-muted hover:text-accent" aria-label="Link öffnen">
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section className="mt-10">
          <button onClick={() => setShowDone((s) => !s)} className="flex items-center gap-2 text-lg font-semibold">
            {showDone ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            Erledigt <span className="text-sm font-normal text-muted">({done.length})</span>
          </button>
          {showDone && (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {done.map((i) => (
                <li key={i.id}>
                  <button onClick={() => setDoneFor(i)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-foreground/5">
                    <span>{KINDS[i.kind].emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{i.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {formatDate(i.done_at!, { day: "numeric", month: "short", year: "numeric" })}
                        {i.done_note && ` · ${i.done_note}`}
                      </span>
                    </span>
                    {i.rating && <Stars value={i.rating} size={14} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {edit && <IdeaDialog idea={edit.idea} onClose={() => setEdit(null)} />}
      {doneFor && <DoneDialog idea={doneFor} onClose={() => setDoneFor(null)} />}
    </>
  );
}

function DoneDialog({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const today = useToday();
  const [date, setDate] = useState(idea.done_at ?? today);
  const [rating, setRating] = useState<number | null>(idea.rating);
  const [note, setNote] = useState(idea.done_note ?? "");

  async function save() {
    await getSupabase()
      .from("ideas")
      .update({ done_at: date || today, rating, done_note: note.trim() || null })
      .eq("id", idea.id);
    toastSaved(idea.done_at ? "Gespeichert" : "Als erledigt gespeichert");
    onClose();
  }

  async function reopen() {
    await getSupabase().from("ideas").update({ done_at: null, rating: null, done_note: null }).eq("id", idea.id);
    onClose();
  }

  return (
    <Modal
      title={`${KINDS[idea.kind].emoji} ${idea.title}`}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {idea.done_at && (
            <button type="button" onClick={reopen} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-foreground/5">
              Wieder offen
            </button>
          )}
          <SaveButtons onCancel={onClose} label={idea.done_at ? "Speichern" : "Als erledigt speichern"} />
        </>
      }
    >
      <Field label="Wann?">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Wie war's? (optional)">
        <div>
          <Stars value={rating} onChange={setRating} size={26} />
        </div>
      </Field>
      <textarea placeholder="Kurzes Fazit (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
    </Modal>
  );
}
