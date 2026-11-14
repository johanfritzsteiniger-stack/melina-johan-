import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";
import { fetchWithRefresh } from "@/lib/table-bus";

let client: SupabaseClient | undefined;

/** Supabase-Client für den Browser (eine Instanz pro Tab). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
      // Nach jedem Speichern die betroffene Tabelle überall neu laden
      global: { fetch: fetchWithRefresh },
    });
  }
  return client;
}
