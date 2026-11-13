import { NextResponse, type NextRequest } from "next/server";
import { adminClient, currentUserId, loadProfiles, missingConfig, sendToUsers } from "@/lib/server/push";

/**
 * Benachrichtigt die andere Person über eine Aktivität
 * (z. B. "Melina hat einen Termin eingetragen"). Body: { title, body, url, test? }
 * Mit test=true geht die Nachricht an die eigenen Geräte.
 */
export async function POST(request: NextRequest) {
  const userId = await currentUserId(request);
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const missing = missingConfig();
  if (missing.length) return NextResponse.json({ error: "Push ist noch nicht eingerichtet: " + missing.join(", ") }, { status: 503 });

  const { title, body, url, test } = (await request.json()) as {
    title?: string;
    body?: string;
    url?: string;
    test?: boolean;
  };
  if (!title) return NextResponse.json({ error: "Titel fehlt" }, { status: 400 });

  const db = adminClient();
  const profiles = await loadProfiles(db);
  const me = profiles.find((p) => p.id === userId);

  const recipients = test
    ? [userId]
    : profiles.filter((p) => p.id !== userId && p.prefs.activity).map((p) => p.id);

  const sent = await sendToUsers(db, recipients, {
    title: test ? title : `${me?.display_name ?? "Jemand"}: ${title}`,
    body: body?.slice(0, 200),
    url: url ?? "/",
  });
  return NextResponse.json({ ok: true, sent });
}
