"use client";

import { useState } from "react";
import { DeleteButton, Chips, Modal, SaveButtons, inputClass } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { notifyPartner } from "@/lib/push-client";
import { deleteWithUndo } from "@/lib/undo";
import { toastSaved } from "@/lib/toast";

export type WatchKind = "film" | "serie";

export type WatchItem = {
  id: string;
  title: string;
  kind: WatchKind;
  platform: string | null;
  note: string | null;
  watched_at: string | null;
  ratings: Record<string, number>;
  created_at: string;
};

export const WATCH_KINDS: Record<WatchKind, string> = { film: "🎬 Film", serie: "📺 Serie" };
export const WATCH_COLUMNS = "id, title, kind, platform, note, watched_at, ratings, created_at";

export function WatchDialog({ item, onClose }: { item: WatchItem | null; onClose: () => void }) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [kind, setKind] = useState<WatchKind>(item?.kind ?? "film");
  const [platform, setPlatform] = useState(item?.platform ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) return;
    const row = { title: title.trim(), kind, platform: platform.trim() || null, note: note.trim() || null };
    const { error } = item
      ? await getSupabase().from("watch_items").update(row).eq("id", item.id)
      : await getSupabase().from("watch_items").insert(row);
    if (error) return setError(error.message);
    if (!item) notifyPartner("Neu auf der Watchlist", `${WATCH_KINDS[kind]} ${row.title}`, "/watchlist");
    toastSaved(item ? "Gespeichert" : "Zur Watchlist hinzugefügt");
    onClose();
  }

  async function remove() {
    if (!item) return;
    const ok = await deleteWithUndo({ table: "watch_items", ids: [item.id], message: `„${item.title}“ gelöscht` });
    if (!ok) return;
    onClose();
  }

  return (
    <Modal
      title={item ? "Bearbeiten" : "Film oder Serie hinzufügen"}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {item && <DeleteButton onClick={remove} />}
          <SaveButtons onCancel={onClose} />
        </>
      }
    >
      <input autoFocus={!item} required placeholder="Titel" value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} text-base font-medium`} />
      <Chips options={[{ value: "film" as const, label: WATCH_KINDS.film }, { value: "serie" as const, label: WATCH_KINDS.serie }]} value={kind} onChange={setKind} />
      <input placeholder="Wo? z. B. Netflix (optional)" value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass} />
      <input placeholder="Notiz, z. B. Empfehlung von Tom (optional)" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
