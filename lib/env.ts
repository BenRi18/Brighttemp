/**
 * Environment variables, read in one place with errors that say what to fix.
 *
 * NEXT_PUBLIC_* values are baked into the build, so they must be set BEFORE
 * the build that uses them. Setting them afterwards and only restarting the
 * process leaves them undefined — rebuild, don't just restart.
 */

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(
      `Missing environment variable ${name}. ` +
        (name.startsWith("NEXT_PUBLIC_")
          ? "Set it in your host's environment variables and rebuild — this one is baked in at build time."
          : "Set it in your host's environment variables."),
    );
  }
  return value;
}

export function supabaseUrl() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must start with https:// — got "${url}". ` +
        "Copy the Project URL from Supabase → Project Settings → Data API.",
    );
  }
  return url;
}

export const supabaseAnonKey = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabaseServiceRoleKey = () =>
  required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

/** True when both public Supabase values are present and usable. */
export function supabaseConfigured() {
  try {
    supabaseUrl();
    supabaseAnonKey();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------

export const resendApiKey = () => required("RESEND_API_KEY", process.env.RESEND_API_KEY);

/**
 * The From address on every notification. Must be on a domain verified in
 * Resend, or everything is rejected with a 403.
 */
export const notificationFrom = () =>
  process.env.NOTIFICATION_FROM?.trim() ||
  "Brighttemp Booking Hub <bookings@brighttempbookinghub.co.uk>";

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  /** The sender, already in Twilio's whatsapp: form. */
  from: string;
};

/**
 * Twilio, for WhatsApp. Returns null rather than throwing when it isn't
 * configured: the queue has to keep draining email while WhatsApp is still
 * waiting on Meta to approve the templates.
 */
export function twilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();

  if (!accountSid || !authToken || !from) return null;

  return {
    accountSid,
    authToken,
    // Tolerates the number being pasted with or without the prefix — the
    // Twilio console shows it both ways depending where you look.
    from: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
  };
}

/** Shared secret on the scheduled routes, which run as service_role. */
export const cronSecret = () => process.env.CRON_SECRET?.trim() || "";
