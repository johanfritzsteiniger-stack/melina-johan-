"use client";

import { useState } from "react";
import { Chips, Field, Modal, SaveButtons, inputClass } from "@/components/ui";
import { getSupabase } from "@/lib/supabase/client";
import { useTable } from "@/lib/use-table";
import { useToday } from "@/lib/use-today";
import { useProfiles } from "@/lib/use-profile";
import { useBattles } from "@/lib/use-battles";
import type { Person } from "@/lib/use-calendar-meta";
import { notifyPartner } from "@/lib/push-client";
import { toastSaved } from "@/lib/toast";
import { LIST_COLUMNS, isListArchived, type List } from "@/lib/lists";
import { formatValue, isArchived } from "@/lib/battles";

const nowSeconds = () => Date.now() / 1000;

/** Schnell etwas auf eine Liste setzen. */
export function QuickListItemDialog({ onClose }: { onClose: () => void }) {
  const today = useToday();
  const lists = useTable<List>("lists", LIST_COLUMNS, [{ column: "sort" }]);
  const active = lists.rows.filter((l) => !isListArchived(l, today));
  const [listId, setListId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const chosen = listId ?? active[0]?.id ?? null;

  async function save() {
    const parts = text.split(/\n|,/).map((t) => t.trim()).filter(Boolean);
    if (!chosen || parts.length === 0) return;
    const base = nowSeconds();
    const { error } = await getSupabase()
      .from("list_items")
      .insert(parts.map((t, n) => ({ list_id: chosen, text: t, sort: base + n })));
    if (error) return setError(error.message);
    const list = active.find((l) => l.id === chosen);
    toastSaved(parts.length === 1 ? `Auf „${list?.name}“ gesetzt` : `${parts.length} Einträge auf „${list?.name}“`);
    onClose();
  }

  return (
    <Modal title="Auf die Liste" onClose={onClose} onSubmit={save} footer={<SaveButtons onCancel={onClose} label="Hinzufügen" />}>
      {active.length === 0 && !lists.loading ? (
        <p className="text-sm text-muted">Noch keine Liste vorhanden – lege zuerst unter „Listen“ eine an.</p>
      ) : (
        <>
          <Chips
            options={active.map((l) => ({ value: l.id, label: `${l.emoji || "📝"} ${l.name}` }))}
            value={chosen ?? ""}
            onChange={setListId}
          />
          <input
            autoFocus
            placeholder="z. B. Milch, Brot, Eier"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${inputClass} text-base`}
          />
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}

/** Schnell einen Battle-Wert eintragen. */
export function QuickBattleEntryDialog({ people, onClose }: { people: Person[]; onClose: () => void }) {
  const today = useToday();
  const { me } = useProfiles();
  const { battles } = useBattles();
  const active = battles.filter((b) => !isArchived(b, today));
  const [battleId, setBattleId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  const battle = active.find((b) => b.id === (battleId ?? active[0]?.id));
  const who = personId ?? me?.id ?? people[0]?.id ?? null;

  async function save() {
    const num = Number(value.replace(",", "."));
    if (!battle || !who || value.trim() === "" || Number.isNaN(num)) {
      setError("Bitte eine Zahl eingeben.");
      return;
    }
    const { error } = await getSupabase()
      .from("battle_entries")
      .insert({ battle_id: battle.id, person_id: who, date: date || today, value: num });
    if (error) return setError(error.message);
    toastSaved("Eingetragen");
    const whoName = people.find((p) => p.id === who)?.display_name;
    notifyPartner(
      `${battle.emoji ?? "🏆"} ${battle.name}`,
      `${who === me?.id ? "" : `für ${whoName}: `}${formatValue(num, battle.unit)} eingetragen`,
      `/battles/${battle.id}`,
    );
    onClose();
  }

  return (
    <Modal title="Battle-Wert eintragen" onClose={onClose} onSubmit={save} footer={<SaveButtons onCancel={onClose} label="Eintragen" />}>
      {active.length === 0 ? (
        <p className="text-sm text-muted">Kein laufendes Battle.</p>
      ) : (
        <>
          <Chips
            options={active.map((b) => ({ value: b.id, label: `${b.emoji || "🏆"} ${b.name}` }))}
            value={battle?.id ?? ""}
            onChange={setBattleId}
          />
          <div className="grid grid-cols-2 gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPersonId(p.id)}
                className={`rounded-lg border px-3 py-2 text-sm ${who === p.id ? "border-accent bg-accent/10 font-medium" : "border-border text-muted"}`}
              >
                {p.display_name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`Wert (${battle?.unit ?? ""})`}>
              <input
                autoFocus
                inputMode="decimal"
                placeholder="0"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                className={`${inputClass} text-base font-medium`}
              />
            </Field>
            <Field label="Datum">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </Field>
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
