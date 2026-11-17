import "server-only";
import { twilioConfig } from "@/lib/env";

/**
 * WhatsApp, through Twilio.
 *
 * Everything provider-specific lives in this file. Moving to Meta's Cloud
 * API later means rewriting sendWhatsApp and nothing else — the queue, the
 * trigger, the renderer and the worker all stay as they are.
 *
 * The thing to understand about WhatsApp: you cannot send free text to
 * someone who has not messaged you in the last 24 hours. A business-initiated
 * message has to use a template Meta approved in advance, and the only thing
 * you supply at send time is the variables. So this sends a template by SID
 * with positional variables, and the plain text we render is used only as the
 * body in the sandbox, where templates are not enforced.
 *
 * See docs/whatsapp-setup.md for the templates and how to get them approved.
 */

export type WhatsAppResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string; permanent: boolean };

/** Twilio's own codes for failures that will fail the same way every time. */
const PERMANENT_CODES = new Set([
  63003, // channel not found / recipient not on WhatsApp
  63007, // no matching sender
  63016, // free-form message outside the 24h window, no template
  63024, // invalid message recipient
  21211, // invalid 'To' number
  21614, // not a mobile number
]);

export function whatsAppConfigured(): boolean {
  return twilioConfig() !== null;
}

/**
 * `to` must already be E.164 (+447700900123). The database normalises it on
 * the way onto the queue, so anything that got this far has been checked.
 */
export async function sendWhatsApp(
  to: string,
  body: string,
  template?: { sid: string; variables: string[] },
): Promise<WhatsAppResult> {
  const config = twilioConfig();
  if (!config) {
    return { ok: false, error: "WhatsApp is not configured", permanent: false };
  }

  const form = new URLSearchParams({
    From: config.from,
    To: `whatsapp:${to}`,
  });

  if (template) {
    // Twilio takes approved templates as a content SID plus its variables,
    // keyed by position as strings.
    form.set("ContentSid", template.sid);
    form.set(
      "ContentVariables",
      JSON.stringify(
        Object.fromEntries(template.variables.map((v, i) => [String(i + 1), v])),
      ),
    );
  }

  // Shown if the template cannot be used — the sandbox, mainly.
  form.set("Body", body);

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
        signal: AbortSignal.timeout(15_000),
      },
    );

    const detail = (await response.json().catch(() => ({}))) as {
      sid?: string;
      code?: number;
      message?: string;
    };

    if (!response.ok) {
      const code = detail.code ?? 0;
      return {
        ok: false,
        error: `${response.status} ${code} ${detail.message ?? ""}`.trim().slice(0, 300),
        // A rejected number fails the same way every time; rate limiting and
        // 5xx are worth another go.
        permanent:
          PERMANENT_CODES.has(code) ||
          (response.status >= 400 && response.status < 500 && response.status !== 429),
      };
    }

    return { ok: true, messageId: detail.sid ?? null };
  } catch (cause) {
    // Timeout or network blip.
    return { ok: false, error: String(cause).slice(0, 300), permanent: false };
  }
}
