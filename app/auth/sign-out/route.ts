import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mockModeEnabled, MOCK_ROLE_COOKIE } from "@/lib/supabase/mock";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  if (mockModeEnabled()) response.cookies.set(MOCK_ROLE_COOKIE, "visitor", { path: "/" });
  return response;
}
