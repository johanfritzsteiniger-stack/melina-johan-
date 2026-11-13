"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";

export type Profile = {
  id: string;
  display_name: string;
  email: string | null;
  color: string | null;
};

/** Lädt das Profil der eingeloggten Person und alle Profile (also euch beide). */
export function useProfiles() {
  const [me, setMe] = useState<Profile | null>(null);
  const [all, setAll] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, email, color")
        .order("created_at");
      if (cancelled) return;
      const profiles = (data ?? []) as Profile[];
      setAll(profiles);
      setMe(profiles.find((p) => p.id === auth.user?.id) ?? null);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { me, all, loading, setMe };
}
