"use client";

import { useState } from "react";
import { DeleteButton, Chips, Modal, SaveButtons, inputClass } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { notifyPartner } from "@/lib/push-client";
import { deleteWithUndo } from "@/lib/undo";
import { toastSaved } from "@/lib/toast";

export type IdeaKind = "restaurant" | "ausflug" | "reise" | "aktivitaet" | "sonstiges";

export type Idea = {
  id: string;
  title: string;
  kind: IdeaKind;
  location: string | null;
  link: string | null;
  note: string | null;
  done_at: string | null;
  done_note: string | null;
  rating: number | null;
  created_at: string;
};

export const IDEA_KINDS: Record<IdeaKind, { label: string; emoji: string }> = {
  restaurant: { label: "Restaurant", emoji: "🍽️" },
  ausflug: { label: "Ausflug", emoji: "🥾" },
  reise: { label: "Reise", emoji: "✈️" },
  aktivitaet: { label: "Aktivität", emoji: "🎳" },
  sonstiges: { label: "Sonstiges", emoji: "💡" },
};

export const IDEA_COLUMNS = "id, title, kind, location, link, note, done_at, done_note, rating, created_at";

export function IdeaDialog({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const [title, setTitle] = useState(idea?.title ?? "");
  const [kind, setKind] = useState<IdeaKind>(idea?.kind ?? "restaurant");
  const [location, setLocation] = useState(idea?.location ?? "");
  const [link, setLink] = useState(idea?.link ?? "");
  const [note, setNote] = useState(idea?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) return;
    let url = link.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    const row = { title: title.trim(), kind, location: location.trim() || null, link: url || null, note: note.trim() || null };
    const q = idea
      ? getSupabase().from("ideas").update(row).eq("id", idea.id)
      : getSupabase().from("ideas").insert(row);
    const { error } = await q;
    if (error) return setError(error.message);
    if (!idea) notifyPartner("Neue Idee", `${IDEA_KINDS[kind].emoji} ${row.title}`, "/ideen");
    toastSaved(idea ? "Gespeichert" : "Idee gespeichert");
    onClose();
  }

  async function remove() {
    if (!idea) return;
    const ok = await deleteWithUndo({ table: "ideas", ids: [idea.id], message: `„${idea.title}“ gelöscht` });
    if (!ok) return;
    onClose();
  }

  return (
    <Modal
      title={idea ? "Idee bearbeiten" : "Neue Idee"}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {idea && <DeleteButton onClick={remove} />}
          <SaveButtons onCancel={onClose} />
        </>
      }
    >
      <input autoFocus={!idea} required placeholder="Was?" value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} text-base font-medium`} />
      <Chips
        options={(Object.keys(IDEA_KINDS) as IdeaKind[]).map((k) => ({ value: k, label: `${IDEA_KINDS[k].emoji} ${IDEA_KINDS[k].label}` }))}
        value={kind}
        onChange={setKind}
      />
      <input placeholder="Ort (optional)" value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
      <input placeholder="Link (optional)" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} />
      <textarea placeholder="Notiz (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
