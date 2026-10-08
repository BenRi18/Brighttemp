import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/site-url";
import type { UserType } from "@/lib/database.types";

/**
 * Where every link in a Supabase email lands.
 *
 * Why not /auth/callback? That route exchanges a one-time `code` for a session,
 * and the exchange needs the code_verifier cookie that was set in the browser
 * which started the signup. A dental nurse who signs up on a laptop and then
 * opens the email on her phone has no such cookie, so the link fails — every
 * time, for everyone who checks their email anywhere else. Email scanners that
 * pre-open links burn the code the same way.
 *
 * Verifying a token_hash has no such requirement: it works from any browser, on
 * any device, once. /auth/callback stays for OAuth sign-in, which does need the
 * code exchange.
 */

const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const;

type EmailOtpType = (typeof EMAIL_OTP_TYPES)[number];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (EMAIL_OTP_TYPES as readonly string[]).includes(value);
}

const HOME: Record<UserType, string> = {
  practice: "/practice",
  locum: "/locum",
  admin: "/admin",
};

/** Relative redirect: the public host is the proxy's business, not ours. */
function to(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!tokenHash || !isEmailOtpType(type)) {
    return to("/login?error=bad_link");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error || !data.user) {
    // Expired, already used, or opened twice because a mail client pre-fetched it.
    return to("/login?error=expired_link");
  }

  // A recovery link must land on the page that sets a new password, whatever
  // the template asked for.
  if (type === "recovery") {
    return to("/update-password");
  }

  // Otherwise honour `next` if it is a path on this site, and fall back to the
  // signed-in user's own area rather than the marketing page.
  const userType = (data.user.app_metadata?.user_type ?? "practice") as UserType;
  return to(safeInternalPath(searchParams.get("next"), HOME[userType] ?? "/practice"));
}
