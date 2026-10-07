import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { mockModeEnabled, MOCK_ROLE_COOKIE } from "@/lib/supabase/mock";
import { isSupabaseAuthCookie, revokeSessionQuietly } from "@/lib/supabase/sign-out";

export async function POST() {
  const cookieStore = await cookies();

  // Read the session cookie names before signing out, because a successful
  // sign-out removes them from the store.
  const sessionCookies = cookieStore
    .getAll()
    .filter((c) => isSupabaseAuthCookie(c.name))
    .map((c) => c.name);

  const supabase = await createClient();
  await revokeSessionQuietly(supabase);

  // A relative Location, deliberately. Building an absolute URL from
  // request.url can pick up the wrong host or port behind Hostinger's proxy
  // and send the user somewhere that doesn't answer.
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: "/login" },
  });

  // Expire them on the response too, so the browser drops the session even if
  // the call to Supabase never got through.
  for (const name of sessionCookies) {
    response.cookies.set(name, "", { path: "/", expires: new Date(0) });
  }

  if (mockModeEnabled()) response.cookies.set(MOCK_ROLE_COOKIE, "visitor", { path: "/" });
  return response;
}
