import { NextResponse, type NextRequest } from "next/server";
import { adminClient, currentUserId } from "@/lib/server/push";
import { ensurePuzzle } from "@/lib/server/crossword";
import { berlinParts } from "@/lib/tz";

/**
 * Erzeugt bei Bedarf das heutige Rätsel (falls der Zeitplaner noch nicht lief).
 * Body: { replace?: true } ersetzt ein noch nicht begonnenes Rätsel durch ein neues.
 */
export async function POST(request: NextRequest) {
  const userId = await currentUserId(request);
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY fehlt in Vercel" }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { replace?: boolean };
  const today = berlinParts(new Date()).date;
  const result = await ensurePuzzle(adminClient(), today, { replace: body.replace === true });
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ...result, date: today });
}
