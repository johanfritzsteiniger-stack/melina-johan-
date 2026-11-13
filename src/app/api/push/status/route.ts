import { NextResponse, type NextRequest } from "next/server";
import { currentUserId, missingConfig } from "@/lib/server/push";

/** Zeigt der Einrichtungsseite, welche Einstellungen in Vercel noch fehlen. */
export async function GET(request: NextRequest) {
  const userId = await currentUserId(request);
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const missing = missingConfig();
  if (!process.env.CRON_SECRET) missing.push("CRON_SECRET");
  return NextResponse.json({ missing });
}
