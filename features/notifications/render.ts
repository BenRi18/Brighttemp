import { canonicalUrl } from "@/lib/site-url";
import type { Enums } from "@/lib/database.types";

export type Event = Enums<"notification_event">;

/**
 * What the database put on the row. Every field is optional because a
 * payload is built by a SQL function and the renderer must not throw when
 * one of them is absent — a notification with a thin payload is still worth
 * sending.
 */
export type Payload = {
  reference?: string;
  booking_date?: string;
  start_time?: string;
  finish_time?: string;
  hours?: number | string;
  locum_total?: number | string;
  hourly_rate?: number | string;
  practice_name?: string;
  practice_city?: string;
  locum_name?: string;
  role_name?: string;
  /** Which portal the link should point at. Set by the trigger. */
  side?: "locum" | "practice";
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

/**
 * The email for one queued notification.
 *
 * Plain and short on purpose. These arrive among a practice manager's real
 * post — what happened, when, and one link. No marketing furniture, nothing
 * that needs images to make sense.
 */
export function render(
  event: Event,
  payload: Payload,
  bookingId: string | null,
  fallbackSubject?: string | null,
): RenderedEmail {
  const when = describeShift(payload);
  const link = bookingLink(payload.side, bookingId) ?? shiftLink(event);
  const practice = payload.practice_name ?? "a practice";
  const locum = payload.locum_name ?? "The locum";

  let subject = fallbackSubject ?? "Brighttemp";
  let lead = "";
  let action = "";

  switch (event) {
    case "booking_requested":
      subject = fallbackSubject ?? `New shift request — ${when}`;
      lead = `${practice} would like to book you for ${when}.`;
      action = "Open your bookings to accept or decline.";
      break;

    case "booking_accepted":
      subject = fallbackSubject ?? `${locum} accepted your booking`;
      lead = `${locum} has accepted your booking for ${when}.`;
      action = "Open the booking to confirm it.";
      break;

    case "booking_confirmed":
      subject = fallbackSubject ?? `Booking confirmed — ${when}`;
      lead = `The booking for ${when} is confirmed${
        payload.reference ? `, reference ${payload.reference}` : ""
      }.`;
      action = "Open the booking for the full details.";
      break;

    case "booking_cancelled":
      subject = fallbackSubject ?? `Booking cancelled — ${when}`;
      lead = `The booking for ${when} has been cancelled${
        payload.reference ? `, reference ${payload.reference}` : ""
      }.`;
      action = "Open the booking to see what happened.";
      break;

    case "shift_posted":
      subject =
        fallbackSubject ?? `${payload.role_name ?? "Shift"} available — ${when}`;
      lead = `${practice}${
        payload.practice_city ? ` in ${payload.practice_city}` : ""
      } needs cover for ${when}.`;
      action =
        "If you're free, say so on the shift board — you'll be one of whoever " +
        "offers, and the practice picks.";
      break;

    case "shift_claimed":
      subject = fallbackSubject ?? `${locum} is available for your shift`;
      lead = `${locum} has offered to cover ${when}.`;
      action = payload.hourly_rate
        ? `Their rate is £${payload.hourly_rate} an hour — £${
            payload.locum_total ?? "—"
          } for the shift. Open it to book them, or wait and see who else offers.`
        : "Open it to book them, or wait and see who else offers.";
      break;

    case "shift_filled":
      subject = fallbackSubject ?? "That shift has been filled";
      lead = `The ${when} shift at ${practice} has gone to someone else.`;
      action = "Your day is free again — there may be other shifts on the board.";
      break;

    default:
      lead = fallbackSubject ?? "There's an update on your Brighttemp account.";
      break;
  }

  const text = [lead, action, link].filter(Boolean).join("\n\n");

  return { subject, text, html: wrap(subject, lead, action, link) };
}

export type RenderedWhatsApp = {
  /** Sent as-is in the Twilio sandbox, and as the fallback body in production. */
  body: string;
  /** Template variables in the order the approved template expects them. */
  variables: string[];
};

/**
 * The WhatsApp version of the same message.
 *
 * Shorter and blunter than the email, because it arrives on a lock screen
 * among messages from real people — one sentence saying what happened and a
 * link. No sign-off: the sender name is already the business.
 *
 * The variables must stay in step with the templates in docs/whatsapp-setup.md.
 * Meta approves the wording and the number of placeholders; changing either
 * here without resubmitting the template means Meta rejects the send. A
 * submitted template cannot be edited either — a change means creating a new
 * one and swapping its SID — so the wording is worth getting right once.
 *
 * Three of WhatsApp's template rules shape these sentences:
 *   - no variable may open or close the body, which is why every one of
 *     these ends in words rather than the link;
 *   - no two variables may be adjacent;
 *   - at least (2n + 1) fixed words for n variables.
 */
export function renderWhatsApp(
  event: Event,
  payload: Payload,
  bookingId: string | null,
): RenderedWhatsApp {
  const when = describeShift(payload);
  const link = bookingLink(payload.side, bookingId) ?? shiftLink(event) ?? canonicalUrl();
  const practice = payload.practice_name ?? "A practice";
  const locum = payload.locum_name ?? "The locum";
  const reference = payload.reference ?? "—";

  switch (event) {
    case "shift_posted":
      return {
        body: `A shift is available on Brighttemp. ${practice} needs cover for ${when}. Open ${link} to offer if you are free.`,
        variables: [practice, when, link],
      };

    case "shift_claimed":
      return {
        body: `You have an offer on Brighttemp. ${locum} is available for your shift on ${when}. Open ${link} to book them.`,
        variables: [locum, when, link],
      };

    case "shift_filled":
      return {
        body: `The shift on ${when} at ${practice} has been filled by someone else. Open ${link} to see other shifts.`,
        variables: [when, practice, link],
      };

    case "booking_requested":
      return {
        body: `Hi ${locum}, you have a shift request on Brighttemp. ${practice} would like to book you for ${when}. Open ${link} to accept or decline.`,
        variables: [locum, practice, when, link],
      };

    case "booking_accepted":
      return {
        body: `Good news — ${locum} has accepted your booking for ${when}. Open ${link} to see the details.`,
        variables: [locum, when, link],
      };

    case "booking_confirmed":
      return {
        body: `Your Brighttemp booking for ${when} is confirmed, reference ${reference}. Open ${link} to see the details.`,
        variables: [when, reference, link],
      };

    case "booking_cancelled":
      return {
        body: `The Brighttemp booking for ${when} has been cancelled, reference ${reference}. Open ${link} to see the details.`,
        variables: [when, reference, link],
      };

    default:
      // No template for anything else, so this is only ever sent as plain
      // text inside an open 24-hour window or in the sandbox.
      return {
        body: `There's an update on your Brighttemp account: ${link}`,
        variables: [link],
      };
  }
}

/**
 * The approved template to use for an event, if one has been set up.
 *
 * Twilio identifies templates by content SID, not by name, so each one is an
 * environment variable you fill in after Meta approves it. Nothing here
 * throws when they are missing: without a SID the worker sends plain text,
 * which is exactly what the sandbox wants while you are still testing.
 */
export function whatsAppTemplateSid(event: Event): string | undefined {
  return process.env[`TWILIO_TEMPLATE_${event.toUpperCase()}`]?.trim() || undefined;
}

/** "Friday 6 November 2026, 09:00–17:00" — as much of it as we actually have. */
function describeShift(payload: Payload): string {
  const date = payload.booking_date?.trim();
  const times =
    payload.start_time && payload.finish_time
      ? `${payload.start_time}–${payload.finish_time}`
      : null;

  if (date && times) return `${date}, ${times}`;
  if (date) return date;
  if (times) return times;
  return "an upcoming shift";
}

function bookingLink(side: Payload["side"], bookingId: string | null): string | null {
  if (!bookingId) return null;
  const path = side === "practice" ? "practice" : "locum";
  return `${canonicalUrl().replace(/\/$/, "")}/${path}/bookings/${bookingId}`;
}

/**
 * Shift messages have no booking to point at — the whole point is that
 * nobody is booked yet — so they go to the board instead. The locum's board
 * and the practice's list of posted gaps are different pages.
 */
function shiftLink(event: Event): string | null {
  const base = canonicalUrl().replace(/\/$/, "");
  if (event === "shift_claimed") return `${base}/practice/shifts`;
  if (event === "shift_posted" || event === "shift_filled") return `${base}/locum/shifts`;
  return null;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * One table, inline styles, no external images. Anything cleverer than this
 * renders differently in Outlook and is not worth the trouble for a message
 * whose job is to carry one sentence and one link.
 */
function wrap(subject: string, lead: string, action: string, link: string | null) {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px;background:#F7F4EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#12211F">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #D5DFD8">
    <tr><td style="padding:28px">
      <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#5E7370;font-weight:600">Brighttemp Booking Hub</p>
      <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0E3B36">${escape(subject)}</h1>
      <p style="margin:0 0 12px;font-size:16px;line-height:1.6">${escape(lead)}</p>
      ${action ? `<p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#5E7370">${escape(action)}</p>` : ""}
      ${
        link
          ? `<p style="margin:0 0 8px"><a href="${escape(link)}" style="display:inline-block;background:#0E3B36;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:999px;font-weight:600;font-size:15px">Open Brighttemp</a></p>
      <p style="margin:12px 0 0;font-size:13px;color:#5E7370;word-break:break-all">${escape(link)}</p>`
          : ""
      }
    </td></tr>
  </table>
  <p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#5E7370;text-align:center">
    You're getting this because you have a Brighttemp account.
  </p>
</body>
</html>`;
}
