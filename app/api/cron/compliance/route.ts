import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Nightly sweep. Rolls approved documents into expiring_soon / expired and
 * recomputes is_bookable, so a lapsed certificate removes a locum from search
 * without anyone doing anything.
 *
 * Schedule with Vercel Cron or pg_cron. Protected by a shared secret because
 * it runs as service_role.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("refresh_compliance_statuses");

  if (error) {
    console.error("compliance sweep failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, documentsChanged: data ?? 0 });
}
