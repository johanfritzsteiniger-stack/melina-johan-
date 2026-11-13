"use client";

import { useMemo, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SwipeRow } from "@/components/swipe-row";
import { SkeletonList } from "@/components/skeleton";
import { getSupabase } from "@/lib/supabase/client";
import { useTable } from "@/lib/use-table";
import { useToday } from "@/lib/use-today";
import { useCalendarMeta } from "@/lib/use-calendar-meta";
import { formatDate } from "@/lib/calendar";
import { notifyPartner } from "@/lib/push-client";
import { deleteWithUndo } from "@/lib/undo";
import { toastSaved } from "@/lib/toast";
import {
  ITEM_COLUMNS,
  LIST_COLUMNS,
  archivedDate,
  isListArchived,
  type List,
  type ListItem,
} from "@/lib/lists";

const input =
  "w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent";

export default function ListenPage() {
  const today = useToday();
  const lists = useTable<List>("lists", LIST_COLUMNS, [
    { column: "sort" },
    { column: "created_at" },
  ]);
  const items = useTable<ListItem>("list_items", ITEM_COLUMNS, [
    { column: "sort" },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ list: List | null } | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const active = lists.rows.filter((l) => !isListArchived(l, today));
  const archived = lists.rows
    .filter((l) => isListArchived(l, today))
    .sort((a, b) => archivedDate(b).localeCompare(archivedDate(a)));

  const openCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items.rows)
      if (!i.done_at) m.set(i.list_id, (m.get(i.list_id) ?? 0) + 1);
    return m;
  }, [items.rows]);

  const selected = lists.rows.find((l) => l.id === selectedId) ?? null;
  const error = lists.error ?? items.error;

  async function createFromTemplate(source: List) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("lists")
      .insert({
        name: source.name,
        emoji: source.emoji,
        sort: Date.now() / 1000,
      })
      .select("id")
      .single();
    if (error || !data) return;
    const copy = items.rows
      .filter((i) => i.list_id === source.id)
      .map((i, n) => ({
        list_id: data.id,
        text: i.text,
        quantity: i.quantity,
        sort: n,
      }));
    if (copy.length) await supabase.from("list_items").insert(copy);
    setSelectedId(data.id);
  }

  if (selected) {
    return (
      <ListView
        list={selected}
        items={items.rows.filter((i) => i.list_id === selected.id)}
        archived={isListArchived(selected, today)}
        onBack={() => setSelectedId(null)}
        onEdit={() => setDialog({ list: selected })}
        onTemplate={() => createFromTemplate(selected)}
        dialog={
          dialog && (
            <ListDialog
              list={dialog.list}
              onClose={() => setDialog(null)}
              onSaved={(id) => setSelectedId(id)}
              onDeleted={() => setSelectedId(null)}
            />
          )
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Listen"
        action={
          <button
            onClick={() => setDialog({ list: null })}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Liste</span>
          </button>
        }
      />

      {error && <ErrorBox text={error} />}

      {lists.loading ? (
        <SkeletonList />
      ) : active.length === 0 && !error ? (
        <button
          onClick={() => setDialog({ list: null })}
          className="w-full rounded-2xl border border-dashed border-border p-8 text-sm text-muted hover:border-accent/50"
        >
          Noch keine Liste – z. B. „Einkauf“ oder „Packliste Tirol“ anlegen
        </button>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {active.map((l) => {
            const open = openCount.get(l.id) ?? 0;
            return (
              <li key={l.id}>
                <button
                  onClick={() => setSelectedId(l.id)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-accent/50"
                >
                  <span className="text-xl">{l.emoji || "📝"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{l.name}</span>
                    <span className="block text-xs text-muted">
                      {open === 0 ? "alles erledigt" : `${open} offen`}
                      {l.expires_on && ` · bis ${formatDate(l.expires_on)}`}
                    </span>
                  </span>
                  <ChevronRight size={18} className="text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="mt-10">
          <button
            onClick={() => setShowArchive((s) => !s)}
            className="flex items-center gap-2 text-lg font-semibold"
          >
            {showArchive ? (
              <ChevronDown size={18} />
            ) : (
              <ChevronRight size={18} />
            )}
            Archiv{" "}
            <span className="text-sm font-normal text-muted">
              ({archived.length})
            </span>
          </button>
          {showArchive && (
            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {archived.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => setSelectedId(l.id)}
                    className="flex w-full items-center gap-3 p-4 text-left hover:bg-foreground/5"
                  >
                    <span>{l.emoji || "📝"}</span>
                    <span className="min-w-0 flex-1 truncate">{l.name}</span>
                    <span className="text-xs text-muted">
                      {formatDate(archivedDate(l), {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {dialog && (
        <ListDialog
          list={dialog.list}
          onClose={() => setDialog(null)}
          onSaved={(id) => setSelectedId(id)}
        />
      )}
    </>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
      {text}
    </p>
  );
}

// ---------- Einzelne Liste ----------

function ListView({
  list,
  items,
  archived,
  onBack,
  onEdit,
  onTemplate,
  dialog,
}: {
  list: List;
  items: ListItem[];
  archived: boolean;
  onBack: () => void;
  onEdit: () => void;
  onTemplate: () => void;
  dialog: React.ReactNode;
}) {
  const meta = useCalendarMeta();
  const [text, setText] = useState("");
  const [showDone, setShowDone] = useState(false);
  const open = items.filter((i) => !i.done_at);
  const done = items
    .filter((i) => i.done_at)
    .sort((a, b) => (b.done_at ?? "").localeCompare(a.done_at ?? ""));

  async function add(e: React.FormEvent) {
    e.preventDefault();
    // Mehrere Einträge auf einmal: durch Zeilenumbruch oder Komma getrennt
    const parts = text
      .split(/\n|,/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setText("");
    const base = Date.now() / 1000;
    await getSupabase()
      .from("list_items")
      .insert(
        parts.map((t, n) => ({ list_id: list.id, text: t, sort: base + n })),
      );
  }

  async function toggle(item: ListItem) {
    const { data } = await getSupabase().auth.getUser();
    await getSupabase()
      .from("list_items")
      .update(
        item.done_at
          ? { done_at: null, done_by: null }
          : {
              done_at: new Date().toISOString(),
              done_by: data.user?.id ?? null,
            },
      )
      .eq("id", item.id);
  }

  async function removeItem(item: ListItem) {
    await deleteWithUndo({
      table: "list_items",
      ids: [item.id],
      message: `„${item.text}“ gelöscht`,
    });
  }

  async function clearDone() {
    await deleteWithUndo({
      table: "list_items",
      ids: done.map((i) => i.id),
      message: `${done.length} erledigte Einträge gelöscht`,
    });
  }

  async function setArchived(value: boolean) {
    await getSupabase()
      .from("lists")
      .update({
        archived_at: value ? new Date().toISOString() : null,
        // Beim Wiederherstellen ein abgelaufenes Datum entfernen
        ...(value ? {} : { expires_on: null }),
      })
      .eq("id", list.id);
    if (value) onBack();
  }

  const doneByName = (id: string | null) =>
    meta.people.find((p) => p.id === id)?.display_name;

  return (
    <>
      <header className="mb-5 flex items-start gap-3">
        <button
          onClick={onBack}
          className="mt-1 rounded-lg p-1 text-muted hover:bg-foreground/5"
          aria-label="Zurück"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {list.emoji || "📝"} {list.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {archived
              ? `Im Archiv seit ${formatDate(archivedDate(list), { day: "numeric", month: "short", year: "numeric" })}`
              : `${open.length} offen${list.expires_on ? ` · wird am ${formatDate(list.expires_on, { day: "numeric", month: "short" })} archiviert` : ""}`}
          </p>
        </div>
        <button
          onClick={onEdit}
          className="rounded-lg p-2 text-muted hover:bg-foreground/5"
          aria-label="Liste bearbeiten"
        >
          <Pencil size={18} />
        </button>
      </header>

      {archived ? (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setArchived(false)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-foreground/5"
          >
            <ArchiveRestore size={16} /> Wiederherstellen
          </button>
          <button
            onClick={onTemplate}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
          >
            <Copy size={16} /> Als Vorlage für neue Liste
          </button>
        </div>
      ) : (
        <form onSubmit={add} className="mb-4 flex gap-2">
          <input
            autoFocus
            placeholder="Hinzufügen … (mehrere mit Komma)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${input} text-base`}
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-accent-foreground"
            aria-label="Hinzufügen"
          >
            <Plus size={20} />
          </button>
        </form>
      )}

      {!archived && items.length > 0 && (
        <p className="mb-3 text-xs text-muted md:hidden">
          Tipp: nach rechts wischen = abhaken, nach links = löschen
        </p>
      )}

      {!archived && open.length === 0 && done.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <span className="flex-1">
            Alles erledigt. Liste ins Archiv verschieben?
          </span>
          <button
            onClick={() => setArchived(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-medium text-accent-foreground"
          >
            <Archive size={16} /> Archivieren
          </button>
        </div>
      )}

      {open.length > 0 && (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {open.map((i) => (
            <ItemRow
              key={i.id}
              item={i}
              onToggle={() => toggle(i)}
              onDelete={() => removeItem(i)}
              readOnly={archived}
            />
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDone((s) => !s)}
              className="flex flex-1 items-center gap-2 text-sm font-medium text-muted"
            >
              {showDone ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
              Erledigt ({done.length})
            </button>
            {showDone && !archived && (
              <button
                onClick={clearDone}
                className="text-xs text-muted hover:text-red-600"
              >
                Erledigte löschen
              </button>
            )}
          </div>
          {showDone && (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {done.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  sub={[
                    doneByName(i.done_by),
                    i.done_at && formatDate(i.done_at.slice(0, 10)),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  onToggle={() => toggle(i)}
                  onDelete={() => removeItem(i)}
                  readOnly={archived}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {!archived && (
        <button
          onClick={() => setArchived(true)}
          className="mt-8 flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <Archive size={16} /> Liste archivieren
        </button>
      )}

      {dialog}
    </>
  );
}

function ItemRow({
  item,
  sub,
  onToggle,
  onDelete,
  readOnly,
}: {
  item: ListItem;
  sub?: string;
  onToggle: () => void;
  onDelete: () => void;
  readOnly: boolean;
}) {
  const done = Boolean(item.done_at);
  return (
    <li>
      <SwipeRow
        onSwipeRight={onToggle}
        onSwipeLeft={onDelete}
        rightLabel={done ? "Wieder offen" : "Erledigt"}
        rightIsUndo={done}
        disabled={readOnly}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onToggle}
            disabled={readOnly}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
              done
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border"
            }`}
            aria-label={done ? "Als offen markieren" : "Abhaken"}
          >
            {done && <Check size={14} strokeWidth={3} />}
          </button>
          <span className="min-w-0 flex-1">
            <span className={`block ${done ? "text-muted line-through" : ""}`}>
              {item.text}
            </span>
            {sub && <span className="block text-xs text-muted">{sub}</span>}
          </span>
          {!readOnly && (
            <button
              onClick={onDelete}
              className="rounded p-1 text-muted hover:text-red-600"
              aria-label="Löschen"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </SwipeRow>
    </li>
  );
}

// ---------- Liste anlegen/bearbeiten ----------

function ListDialog({
  list,
  onClose,
  onSaved,
  onDeleted,
}: {
  list: List | null;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(list?.name ?? "");
  const [emoji, setEmoji] = useState(list?.emoji ?? "");
  const [expires, setExpires] = useState(list?.expires_on ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const row = {
      name: name.trim(),
      emoji: emoji.trim() || null,
      expires_on: expires || null,
    };
    const supabase = getSupabase();
    const { data, error } = list
      ? await supabase
          .from("lists")
          .update(row)
          .eq("id", list.id)
          .select("id")
          .single()
      : await supabase
          .from("lists")
          .insert({ ...row, sort: Date.now() / 1000 })
          .select("id")
          .single();
    if (error) {
      setError("Speichern hat nicht geklappt: " + error.message);
      return;
    }
    if (!list)
      notifyPartner(
        "Neue Liste",
        `${row.emoji ?? "📝"} ${row.name}`,
        "/listen",
      );
    toastSaved(list ? "Gespeichert" : "Liste angelegt");
    onSaved(data.id as string);
    onClose();
  }

  async function remove() {
    if (!list) return;
    const ok = await deleteWithUndo({
      table: "lists",
      ids: [list.id],
      message: `Liste „${list.name}“ gelöscht`,
      dependents: [{ table: "list_items", fk: "list_id", mode: "restore" }],
    });
    if (!ok) return;
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
        className="pb-safe w-full max-w-lg space-y-4 sheet-in rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {list ? "Liste bearbeiten" : "Neue Liste"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted"
            aria-label="Schließen"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex gap-2">
          <input
            placeholder="📝"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-16 shrink-0 rounded-lg border border-border bg-background px-2 py-2 text-center outline-none focus:border-accent"
            aria-label="Emoji"
          />
          <input
            autoFocus={!list}
            required
            placeholder="Name, z. B. Einkauf"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${input} text-base font-medium`}
          />
        </div>
        <label className="block space-y-1">
          <span className="text-sm text-muted">
            Automatisch archivieren nach (optional)
          </span>
          <input
            type="date"
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            className={input}
          />
          <span className="block text-xs text-muted">
            z. B. das Urlaubsende bei einer Packliste
          </span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          {list && (
            <button
              type="button"
              onClick={remove}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10"
            >
              <Trash2 size={16} /> Löschen
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-muted hover:bg-foreground/5"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            Speichern
          </button>
        </div>
      </form>
    </div>
  );
}
