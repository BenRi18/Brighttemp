import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resendApiKey, notificationFrom } from "@/lib/env";
import { render, renderWhatsApp, whatsAppTemplateSid, type Payload, type Event } from "./render";
import { sendWhatsApp, whatsAppConfigured } from "./whatsapp";

export type SendSummary = {
  /** Handed to a provider and accepted. */
  sent: number;
  /** Will be tried again on a later run. */
  retrying: number;
  /** Given up on — a bad address, or five failed attempts. */
  failed: number;
};

/** After this many tries a row is failed rather than retried for ever. */
const MAX_ATTEMPTS = 5;

type Row = {
  id: string;
  event: string;
  channel: string;
  recipient: string;
  subject: string | null;
  payload: unknown;
  booking_id: string | null;
  attempts: number | null;
};

type Client = ReturnType<typeof createAdminClient>;

/**
 * Drains the notification queue.
 *
 * Runs as service_role, so RLS is out of the way. Claiming is done in the
 * database (claim_notifications), which marks each row in flight for five
 * minutes — two overlapping runs therefore take different rows instead of
 * both sending the same one.
 *
 * Never throws for a single bad row. One dead address must not stop the rest
 * of the queue going out.
 */
export async function sendQueued(limit = 50): Promise<SendSummary> {
  const summary: SendSummary = { sent: 0, retrying: 0, failed: 0 };
  const supabase = createAdminClient();

  const { data: queue, error } = await supabase.rpc("claim_notifications", {
    p_limit: limit,
  });

  if (error) {
    console.error("[sendQueued] could not claim rows:", error.message);
    return summary;
  }
  if (!queue || queue.length === 0) return summary;

  for (const row of queue as Row[]) {
    if (row.channel === "whatsapp") {
      await sendOneWhatsApp(supabase, row, summary);
      continue;
    }

    if (row.channel === "email") {
      await sendOneEmail(supabase, row, summary);
      continue;
    }

    // Neither email nor WhatsApp — in_app, for now. Put it back rather than
    // marking it sent, so adding that channel later picks these up instead
    // of losing them. No attempt is burned.
    await requeue(supabase, row, summary);
  }

  return summary;
}

async function sendOneEmail(supabase: Client, row: Row, summary: SendSummary) {
  let key: string;
  try {
    key = resendApiKey();
  } catch {
    // Not configured at all: nothing is wrong with the row, so put it back.
    await requeue(supabase, row, summary);
    return;
  }

  const { subject, text, html } = render(
    row.event as Event,
    (row.payload ?? {}) as Payload,
    row.booking_id,
    row.subject,
  );

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: notificationFrom(),
        to: [row.recipient],
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const detail = (await response.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };

    if (!response.ok) {
      // 4xx is the address or the payload and will not improve on a retry;
      // 429 and 5xx are worth another go.
      const permanent =
        response.status >= 400 && response.status < 500 && response.status !== 429;
      await settle(
        supabase,
        row,
        summary,
        `${response.status} ${detail.message ?? ""}`.trim(),
        permanent,
      );
      return;
    }

    await supabase
      .from("notifications")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: detail.id ?? null,
        error: null,
      })
      .eq("id", row.id);
    summary.sent += 1;
  } catch (cause) {
    await settle(supabase, row, summary, String(cause).slice(0, 300), false);
  }
}

/**
 * One WhatsApp message.
 *
 * Kept apart from the email path because the failure modes are different:
 * email can only really be wrong about the address, whereas WhatsApp can be
 * switched off entirely, waiting on template approval, or sending to someone
 * who simply isn't on WhatsApp. Separating them also keeps one channel's
 * outage from touching the other — the queue is shared, the sending isn't.
 */
async function sendOneWhatsApp(supabase: Client, row: Row, summary: SendSummary) {
  // Not set up yet: put it straight back without burning an attempt, so
  // everything queued while you wait on Meta goes out once it is live.
  if (!whatsAppConfigured()) {
    await requeue(supabase, row, summary);
    return;
  }

  const event = row.event as Event;
  const { body, variables } = renderWhatsApp(
    event,
    (row.payload ?? {}) as Payload,
    row.booking_id,
  );

  const sid = whatsAppTemplateSid(event);
  const result = await sendWhatsApp(
    row.recipient,
    body,
    sid ? { sid, variables } : undefined,
  );

  if (result.ok) {
    await supabase
      .from("notifications")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_message_id: result.messageId,
        error: null,
      })
      .eq("id", row.id);
    summary.sent += 1;
    return;
  }

  await settle(supabase, row, summary, result.error, result.permanent);
}

/**
 * Puts a row back without counting the attempt against it. For "we aren't
 * set up to send this yet", which is not the row's fault and will not be
 * fixed by trying four more times.
 */
async function requeue(supabase: Client, row: Row, summary: SendSummary) {
  await supabase
    .from("notifications")
    .update({
      status: "queued",
      attempts: Math.max((row.attempts ?? 1) - 1, 0),
      last_attempt_at: null,
    })
    .eq("id", row.id);
  summary.retrying += 1;
}

/** Records a failed attempt, and gives up once it has tried enough times. */
async function settle(
  supabase: Client,
  row: Row,
  summary: SendSummary,
  error: string,
  permanent: boolean,
) {
  const attempts = row.attempts ?? 1;
  const giveUp = permanent || attempts >= MAX_ATTEMPTS;

  console.error(
    `[sendQueued] ${row.channel} to ${row.recipient} failed (attempt ${attempts}):`,
    error,
  );

  await supabase
    .from("notifications")
    .update({
      status: giveUp ? "failed" : "queued",
      error: error.slice(0, 500),
    })
    .eq("id", row.id);

  if (giveUp) summary.failed += 1;
  else summary.retrying += 1;
}
