"use client";

import { useState } from "react";
import { Check, Dices, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SkeletonList } from "@/components/skeleton";
import { Chips, ErrorBox, Field, Modal, SaveButtons, Stars, inputClass } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { useTable } from "@/lib/use-table";
import { useToday } from "@/lib/use-today";
import { useCalendarMeta } from "@/lib/use-calendar-meta";
import { useProfiles } from "@/lib/use-profile";
import { formatDate } from "@/lib/calendar";
import { WATCH_COLUMNS as COLUMNS, WATCH_KINDS as KINDS, WatchDialog, type WatchItem, type WatchKind as Kind } from "@/components/dialogs/watch-dialog";
import { toastSaved } from "@/lib/toast";

function average(r: Record<string, number>): number | null {
  const v = Object.values(r ?? {}).filter((x) => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export default function WatchlistPage() {
  const { rows, loading, error } = useTable<WatchItem>("watch_items", COLUMNS, [{ column: "created_at", ascending: false }]);
  const meta = useCalendarMeta();
  const [tab, setTab] = useState<"offen" | "gesehen">("offen");
  const [filter, setFilter] = useState<Kind | "alle">("alle");
  const [edit, setEdit] = useState<{ item: WatchItem | null } | null>(null);
  const [rateFor, setRateFor] = useState<WatchItem | null>(null);
  const [pick, setPick] = useState<WatchItem | null>(null);

  const matches = (i: WatchItem) => filter === "alle" || i.kind === filter;
  const open = rows.filter((i) => !i.watched_at && matches(i));
  const watched = rows
    .filter((i) => i.watched_at && matches(i))
    .sort((a, b) => (b.watched_at ?? "").localeCompare(a.watched_at ?? ""));

  function random() {
    if (!open.length) return;
    setPick(open[Math.floor(Math.random() * open.length)]);
  }

  return (
    <>
      <PageHeader
        title="Watchlist"
        action={
          <div className="flex gap-2">
            <button
              onClick={random}
              disabled={open.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-foreground/5 disabled:opacity-50"
              title="Was schauen wir?"
            >
              <Dices size={18} />
              <span className="hidden sm:inline">Zufall</span>
            </button>
            <button
              onClick={() => setEdit({ item: null })}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Hinzufügen</span>
            </button>
          </div>
        }
      />

      {error && <ErrorBox text={error} />}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-foreground/5 p-1 text-sm">
          {(["offen", "gesehen"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 ${tab === t ? "bg-card font-medium shadow-sm" : "text-muted"}`}
            >
              {t === "offen" ? `Offen (${open.length})` : `Gesehen (${watched.length})`}
            </button>
          ))}
        </div>
        <Chips
          options={[{ value: "alle" as const, label: "Alle" }, { value: "film" as const, label: KINDS.film }, { value: "serie" as const, label: KINDS.serie }]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {pick && tab === "offen" && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <Dices size={20} className="text-accent" />
          <span className="flex-1">
            Heute: <strong>{pick.title}</strong>
            {pick.platform && <span className="text-muted"> · {pick.platform}</span>}
          </span>
          <button onClick={random} className="text-sm text-muted hover:text-foreground">
            Nochmal
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonList />
      ) : tab === "offen" ? (
        open.length === 0 && !error ? (
          <button
            onClick={() => setEdit({ item: null })}
            className="w-full rounded-2xl border border-dashed border-border p-8 text-sm text-muted hover:border-accent/50"
          >
            Nichts auf der Liste – Film oder Serie hinzufügen
          </button>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {open.map((i) => (
              <li key={i.id} className="flex items-center gap-3 p-4">
                <button onClick={() => setEdit({ item: i })} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-medium">{i.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {KINDS[i.kind]}
                    {i.platform && ` · ${i.platform}`}
                    {i.note && ` · ${i.note}`}
                  </span>
                </button>
                <button
                  onClick={() => setRateFor(i)}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:border-accent hover:text-accent"
                >
                  <Check size={14} /> Gesehen
                </button>
              </li>
            ))}
          </ul>
        )
      ) : watched.length === 0 ? (
        <p className="text-sm text-muted">Noch nichts gesehen.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {watched.map((i) => {
            const avg = average(i.ratings);
            return (
              <li key={i.id}>
                <button onClick={() => setRateFor(i)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-foreground/5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{i.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {KINDS[i.kind]} · {formatDate(i.watched_at!, { day: "numeric", month: "short", year: "numeric" })}
                      {meta.people
                        .filter((p) => i.ratings?.[p.id])
                        .map((p) => ` · ${p.display_name} ${i.ratings[p.id]}★`)
                        .join("")}
                    </span>
                  </span>
                  {avg !== null && (
                    <span className="flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums">
                      {avg.toLocaleString("de-DE", { maximumFractionDigits: 1 })}
                      <Stars value={1} size={14} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {edit && <WatchDialog item={edit.item} onClose={() => setEdit(null)} />}
      {rateFor && <RateDialog item={rateFor} people={meta.people} onClose={() => setRateFor(null)} />}
    </>
  );
}

function RateDialog({
  item,
  people,
  onClose,
}: {
  item: WatchItem;
  people: ReturnType<typeof useCalendarMeta>["people"];
  onClose: () => void;
}) {
  const today = useToday();
  const { me } = useProfiles();
  const [date, setDate] = useState(item.watched_at ?? today);
  const [ratings, setRatings] = useState<Record<string, number>>(item.ratings ?? {});

  async function save() {
    const clean = Object.fromEntries(Object.entries(ratings).filter(([, v]) => v));
    await getSupabase()
      .from("watch_items")
      .update({ watched_at: date || today, ratings: clean })
      .eq("id", item.id);
    toastSaved();
    onClose();
  }

  async function reopen() {
    await getSupabase().from("watch_items").update({ watched_at: null }).eq("id", item.id);
    onClose();
  }

  // Eigene Bewertung zuerst
  const ordered = [...people].sort((a, b) => Number(b.id === me?.id) - Number(a.id === me?.id));

  return (
    <Modal
      title={item.title}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {item.watched_at && (
            <button type="button" onClick={reopen} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-foreground/5">
              Zurück auf die Liste
            </button>
          )}
          <SaveButtons onCancel={onClose} label={item.watched_at ? "Speichern" : "Als gesehen speichern"} />
        </>
      }
    >
      <Field label="Gesehen am">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </Field>
      {ordered.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3">
          <span className="text-sm">{p.display_name}</span>
          <Stars
            value={ratings[p.id] ?? null}
            onChange={(v) => setRatings((r) => ({ ...r, [p.id]: v ?? 0 }))}
            size={24}
          />
        </div>
      ))}
      <p className="text-xs text-muted">Jeder kann seine Bewertung auch später noch nachtragen.</p>
    </Modal>
  );
}
