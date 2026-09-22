import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/lib/database.types";

type Client = SupabaseClient<Database>;

export type NotificationDraft = {
  profileId: string | null;
  recipient: string;
  event: Enums<"notification_event">;
  channel?: Enums<"notification_channel">;
  subject?: string;
  payload?: Record<string, unknown>;
  bookingId?: string;
  invoiceId?: string;
  documentId?: string;
};

/**
 * Writes rows onto the notifications queue. A separate worker drains it —
 * nothing is sent inline, so a slow email provider can never fail a booking.
 *
 * Deliberately swallows its own errors: a booking that succeeded must not be
 * reported as failed because the queue insert did.
 */
export async function enqueue(supabase: Client, drafts: NotificationDraft[]) {
  if (!drafts.length) return;

  const rows = drafts.map((d) => ({
    profile_id: d.profileId,
    recipient: d.recipient,
    event: d.event,
    channel: d.channel ?? ("email" as const),
    subject: d.subject ?? null,
    payload: (d.payload ?? {}) as Database["public"]["Tables"]["notifications"]["Insert"]["payload"],
    booking_id: d.bookingId ?? null,
    invoice_id: d.invoiceId ?? null,
    document_id: d.documentId ?? null,
  }));

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) console.error("notification enqueue failed", error.message);
}
