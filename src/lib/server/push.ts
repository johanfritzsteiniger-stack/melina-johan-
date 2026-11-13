// Nur auf dem Server verwenden (API-Routen).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { sendNotification, setVapidDetails } from "web-push";
import type { NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };

export type Notify = { reminders: boolean; daily: boolean; daily_hour: number; activity: boolean };
export const DEFAULT_NOTIFY: Notify = { reminders: true, daily: true, daily_hour: 8, activity: true };

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";

/** Was für den Versand noch fehlt (leer = alles da). */
export function missingConfig(): string[] {
  const missing: string[] = [];
  if (!SERVICE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!VAPID_PUBLIC) missing.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  if (!VAPID_PRIVATE) missing.push("VAPID_PRIVATE_KEY");
  return missing;
}

let vapidSet = false;
function ensureVapid() {
  if (vapidSet) return;
  setVapidDetails("mailto:push@melina-johan.app", VAPID_PUBLIC, VAPID_PRIVATE);
  vapidSet = true;
}

/** Datenbank-Zugriff mit vollen Rechten (umgeht RLS) – nur serverseitig. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Eingeloggte Person aus den Cookies der Anfrage. */
export async function currentUserId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: () => {},
    },
  });
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

export type Profile = { id: string; display_name: string; notify: Partial<Notify> | null };

export async function loadProfiles(db: SupabaseClient): Promise<(Profile & { prefs: Notify })[]> {
  const { data } = await db.from("profiles").select("id, display_name, notify");
  return ((data ?? []) as Profile[]).map((p) => ({ ...p, prefs: { ...DEFAULT_NOTIFY, ...(p.notify ?? {}) } }));
}

/** Schickt eine Nachricht an alle Geräte der Personen. Abgelaufene Geräte werden entfernt. */
export async function sendToUsers(db: SupabaseClient, userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0) return 0;
  ensureVapid();
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12 },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("Push fehlgeschlagen", status, (err as Error).message);
        }
      }
    }),
  );
  return sent;
}

/** true beim ersten Aufruf mit diesem Schlüssel, danach false (verhindert Doppelversand). */
export async function firstTime(db: SupabaseClient, key: string): Promise<boolean> {
  const { error } = await db.from("push_log").insert({ key });
  return !error;
}
