"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ColorPicker } from "@/components/color-picker";
import { getSupabase } from "@/lib/supabase/client";
import { useProfiles, type Profile } from "@/lib/use-profile";
import { setColorMode, useCalendarMeta } from "@/lib/use-calendar-meta";
import { PALETTE } from "@/lib/colors";
import type { Category } from "@/lib/calendar";

const input =
  "w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent";

export default function EinstellungenPage() {
  const { me, setMe } = useProfiles();
  const meta = useCalendarMeta();
  const router = useRouter();
  const [sharedStatus, setSharedStatus] = useState<string | null>(null);

  async function logout() {
    await getSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="space-y-6">
        {me && <ProfileSection key={me.id} me={me} onSaved={setMe} />}

        <Section title="Kalender-Farben">
          <div className="space-y-2">
            <span className="text-sm font-medium">Termine färben nach</span>
            <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
              {(
                [
                  ["person", "Person"],
                  ["category", "Kategorie"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setColorMode(value)}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    meta.mode === value
                      ? "border-accent bg-accent/10 font-medium"
                      : "border-border text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">Gilt für dieses Gerät.</p>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Farbe für „Beide“</span>
            <ColorPicker
              value={meta.sharedColor}
              onChange={async (color) => {
                const { error } = await getSupabase()
                  .from("app_settings")
                  .upsert({ key: "shared_color", value: color });
                setSharedStatus(error ? "Speichern hat nicht geklappt: " + error.message : "Gespeichert.");
                meta.reload();
              }}
            />
            {sharedStatus && <p className="text-xs text-muted">{sharedStatus}</p>}
          </div>
        </Section>

        <CategoriesSection categories={meta.categories} reload={meta.reload} />

        <button
          onClick={logout}
          className="w-full rounded-2xl border border-border bg-card p-4 text-left text-sm font-medium text-red-600 hover:bg-foreground/5"
        >
          Abmelden
        </button>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

// ---------- Profil ----------

function ProfileSection({ me, onSaved }: { me: Profile; onSaved: (p: Profile) => void }) {
  const [name, setName] = useState(me.display_name);
  const [color, setColor] = useState(me.color ?? PALETTE[0]);
  const [status, setStatus] = useState<string | null>(null);

  async function save(next: { display_name?: string; color?: string }) {
    const { error } = await getSupabase().from("profiles").update(next).eq("id", me.id);
    if (error) {
      setStatus("Speichern hat nicht geklappt.");
    } else {
      onSaved({ ...me, ...next });
      setStatus("Gespeichert.");
    }
  }

  return (
    <Section title="Mein Profil">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) save({ display_name: name.trim() });
        }}
        className="space-y-1"
      >
        <span className="text-sm font-medium">Anzeigename</span>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setStatus(null);
            }}
            className={input}
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
          >
            Speichern
          </button>
        </div>
      </form>

      <div className="space-y-2">
        <span className="text-sm font-medium">Meine Farbe im Kalender</span>
        <ColorPicker
          value={color}
          onChange={(c) => {
            setColor(c);
            save({ color: c });
          }}
        />
      </div>

      <div className="flex justify-between text-xs text-muted">
        <span>{me.email && `Angemeldet als ${me.email}`}</span>
        {status && <span>{status}</span>}
      </div>
    </Section>
  );
}

// ---------- Kategorien ----------

function CategoriesSection({
  categories,
  reload,
}: {
  categories: Category[];
  reload: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const used = new Set(categories.map((c) => c.color));
    const color = PALETTE.find((c) => !used.has(c)) ?? PALETTE[0];
    const sort = Math.max(0, ...categories.map((c) => c.sort)) + 1;
    const { error } = await getSupabase()
      .from("categories")
      .insert({ name: newName.trim(), color, sort });
    if (error) {
      setError("Anlegen hat nicht geklappt: " + error.message);
      return;
    }
    setNewName("");
    setError(null);
    reload();
  }

  return (
    <Section title="Kategorien">
      <ul className="space-y-3">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} reload={reload} onError={setError} />
        ))}
      </ul>

      <form onSubmit={add} className="flex gap-2">
        <input
          placeholder="Neue Kategorie, z. B. Sport"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={input}
        />
        <button
          type="submit"
          className="flex shrink-0 items-center gap-1 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
        >
          <Plus size={16} />
          Hinzufügen
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </Section>
  );
}

function CategoryRow({
  category,
  reload,
  onError,
}: {
  category: Category;
  reload: () => void;
  onError: (msg: string | null) => void;
}) {
  const [name, setName] = useState(category.name);
  const [open, setOpen] = useState(false);

  async function update(patch: Partial<Category>) {
    const { error } = await getSupabase().from("categories").update(patch).eq("id", category.id);
    if (error) onError("Speichern hat nicht geklappt: " + error.message);
    else {
      onError(null);
      reload();
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `Kategorie „${category.name}“ löschen? Termine bleiben erhalten, nur ohne Kategorie.`,
      )
    )
      return;
    const { error } = await getSupabase().from("categories").delete().eq("id", category.id);
    if (error) onError("Löschen hat nicht geklappt: " + error.message);
    else reload();
  }

  return (
    <li className="rounded-xl border border-border p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="h-8 w-8 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
          aria-label="Farbe ändern"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name.trim() !== category.name) update({ name: name.trim() });
            else setName(category.name);
          }}
          className={`${input} py-1.5`}
        />
        <button
          type="button"
          onClick={remove}
          className="shrink-0 rounded-lg p-2 text-muted hover:bg-red-500/10 hover:text-red-600"
          aria-label="Kategorie löschen"
        >
          <Trash2 size={18} />
        </button>
      </div>

      {open && (
        <div className="mt-3">
          <ColorPicker
            value={category.color}
            onChange={(color) => {
              update({ color });
              setOpen(false);
            }}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={category.is_birthday}
            onChange={(e) => update({ is_birthday: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Jährlich + Alter anzeigen
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={category.is_countdown}
            onChange={(e) => update({ is_countdown: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Standardmäßig als Countdown
        </label>
      </div>
    </li>
  );
}
