import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Collapse doubled slashes before anything else looks at the path.
  //
  // Supabase builds every email link as {{ .SiteURL }} + "/auth/confirm". If the
  // project's Site URL has been saved with a trailing slash, that produces
  // https://brighttempbookinghub.co.uk//auth/confirm — a path of "//auth/confirm",
  // which matches no route and 404s. The link looks perfectly correct in the
  // email, and nothing reaches Supabase, so there is no log entry to go on.
  // Rather than leave that to a setting nobody remembers, normalise it here.
  const { pathname } = request.nextUrl;
  if (pathname.includes("//")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/\/{2,}/g, "/");
    return NextResponse.redirect(url, { status: 308 });
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files. The session cookie
     * must be refreshed on every navigable request or tokens go stale.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
