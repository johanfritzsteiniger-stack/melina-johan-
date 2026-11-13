"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getSupabase } from "@/lib/supabase/client";
import { useProfiles, type Profile } from "@/lib/use-profile";

export default function EinstellungenPage() {
  const { me, setMe } = useProfiles();
  const router = useRouter();

  async function logout() {
    await getSupabase().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="space-y-4">
        {me && <NameForm key={me.id} me={me} onSaved={setMe} />}
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

function NameForm({
  me,
  onSaved,
}: {
  me: Profile;
  onSaved: (p: Profile) => void;
}) {
  const [name, setName] = useState(me.display_name);
  const [status, setStatus] = useState<string | null>(null);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await getSupabase()
      .from("profiles")
      .update({ display_name: name.trim() })
      .eq("id", me.id);
    if (error) {
      setStatus("Speichern hat nicht geklappt.");
    } else {
      onSaved({ ...me, display_name: name.trim() });
      setStatus("Gespeichert.");
    }
  }

  return (
    <form
      onSubmit={saveName}
      className="space-y-3 rounded-2xl border border-border bg-card p-5"
    >
      <label className="block space-y-1">
        <span className="text-sm font-medium">Anzeigename</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setStatus(null);
          }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-accent"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
        >
          Speichern
        </button>
        {status && <span className="text-sm text-muted">{status}</span>}
      </div>
      {me.email && (
        <p className="text-xs text-muted">Angemeldet als {me.email}</p>
      )}
    </form>
  );
}
