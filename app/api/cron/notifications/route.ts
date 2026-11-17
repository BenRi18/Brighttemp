import { NextResponse, type NextRequest } from "next/server";
import { sendQueued } from "@/features/notifications/send";
import { cronSecret } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Drains the notification queue.
 *
 * This is the piece that was missing: every booking notification was being
 * queued correctly and then sitting there, because nothing ever came to
 * collect it. Needs to run on a schedule — every few minutes, not nightly.
 * A locum who hears about a shift request the next morning has already lost
 * it, and a practice waiting on an acceptance will have rung someone else.
 *
 * Safe to run twice at once: claim_notifications takes rows with FOR UPDATE
 * SKIP LOCKED and marks them in flight for five minutes, so two overlapping
 * runs take different rows rather than both sending the same one.
 *
 * Schedule it in hPanel, every 2 minutes:
 *   curl -s -H "Authorization: Bearer $CRON_SECRET" \
 *     https://brighttempbookinghub.co.uk/api/cron/notifications
 */
export async function GET(request: NextRequest) {
  const secret = cronSecret();
  const provided = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const limit = Number(request.nextUrl.searchParams.get("limit")) || 50;
  const summary = await sendQueued(Math.min(Math.max(limit, 1), 200));

  // Always 200 when the run itself worked. Individual failures are on the
  // rows and in the summary; a non-2xx here would make a scheduler treat a
  // single dead phone number as the whole job falling over.
  return NextResponse.json({ ok: true, ...summary });
}
