import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/site-url";

/**
 * Lands OAuth sign-ins, and any email link still using Supabase's default
 * {{ .ConfirmationURL }}: exchanges the one-time code for a session, then
 * forwards on.
 *
 * Every redirect below is RELATIVE, deliberately.
 *
 * This route used to build them from `new URL(request.url).origin`, which
 * sounds right and isn't. Behind Hostinger's proxy the app is reached on an
 * internal address, and Next reports that address as the request's origin —
 * it does not consult the Host header. The result was a browser being sent to
 *
 *     https://0.0.0.0:3000/login?error=missing_code     → ERR_ADDRESS_INVALID
 *
 * A relative Location sidesteps the question entirely: the browser resolves it
 * against whatever address it actually used, which is the public domain by
 * definition. Same reason /auth/sign-out and /auth/confirm do it this way.
 */
function to(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    return to(`/login?error=${encodeURIComponent(errorDescription)}`);
  }

  if (!code) {
    return to("/login?error=missing_code");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // The usual cause is the link being opened in a different browser from the
    // one that started the signup: this exchange needs a code_verifier cookie
    // that only that browser has. /auth/confirm has no such requirement, which
    // is why the email templates point there instead.
    console.error("[auth/callback] code exchange failed:", {
      code: error.code,
      message: error.message,
    });
    return to("/login?error=expired_link");
  }

  return to(safeInternalPath(searchParams.get("next"), "/"));
}
