import { NextResponse, type NextRequest } from "next/server";
import { adminClient, firstTime, loadProfiles, missingConfig, sendToUsers } from "@/lib/server/push";
import { berlinParts } from "@/lib/tz";
import { dailySummary, dueReminders, reminderBody } from "@/lib/reminders";
import type { CalendarEvent } from "@/lib/calendar";

/**
 * Wird alle 5 Minuten vom Zeitplaner in Supabase aufgerufen.
 * Verschickt fällige Termin-Erinnerungen und die Tagesübersicht.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Nicht erlaubt" }, { status: 401 });
  }
  const missing = missingConfig();
  if (missing.length) return NextResponse.json({ error: "Es fehlt: " + missing.join(", ") }, { status: 500 });

  const db = adminClient();
  const now = new Date();
  const { date: today, hour } = berlinParts(now);
  const profiles = await loadProfiles(db);
  const { data: rows } = await db.from("events").select("*");
  const events = (rows ?? []) as CalendarEvent[];

  let reminders = 0;
  let daily = 0;

  // Termin-Erinnerungen
  for (const due of dueReminders(events, now, today)) {
    if (!(await firstTime(db, due.key))) continue;
    const e = due.occurrence.event;
    const recipients = profiles
      .filter((p) => p.prefs.reminders && (!e.owner_id || e.owner_id === p.id))
      .map((p) => p.id);
    reminders += await sendToUsers(db, recipients, {
      title: e.title,
      body: reminderBody(due.occurrence),
      url: "/kalender",
      tag: due.key,
    });
  }

  // Tagesübersicht zur gewählten Stunde
  for (const p of profiles) {
    if (!p.prefs.daily || p.prefs.daily_hour !== hour) continue;
    const text = dailySummary(events, today);
    if (!text) continue;
    if (!(await firstTime(db, `daily:${p.id}:${today}`))) continue;
    daily += await sendToUsers(db, [p.id], { title: "Euer Tag", body: text, url: "/", tag: `daily-${today}` });
  }

  // Alte Protokolleinträge aufräumen (älter als 30 Tage)
  await db
    .from("push_log")
    .delete()
    .lt("created_at", new Date(now.getTime() - 30 * 86_400_000).toISOString());

  return NextResponse.json({ ok: true, today, hour, reminders, daily });
}
