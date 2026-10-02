import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import type { UserType } from "@/lib/database.types";
import { demoPreviewEnabled } from "@/features/dev/demo";
import { mockModeEnabled, mockUser, parseMockRole, MOCK_ROLE_COOKIE } from "./mock";

/** Paths reachable without a session. */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/update-password",
  "/auth",
  "/pricing",
  "/faqs",
];

const HOME: Record<UserType, string> = {
  practice: "/practice",
  locum: "/locum",
  admin: "/admin",
};

function isPublic(pathname: string) {
  if (demoPreviewEnabled() && (pathname === "/dev" || pathname.startsWith("/dev/"))) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const user = mockModeEnabled()
    ? mockUser(parseMockRole(request.cookies.get(MOCK_ROLE_COOKIE)?.value))
    : await getVerifiedUser(request, (r) => (response = r));

  return route(request, response, user);
}

/** Real mode: refresh the session cookie and verify the user with Supabase. */
async function getVerifiedUser(request: NextRequest, setResponse: (r: NextResponse) => void) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          const response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          setResponse(response);
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase. Do not swap this for
  // getSession(), which trusts whatever is in the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function route(
  request: NextRequest,
  response: NextResponse,
  user: { app_metadata?: Record<string, unknown> } | null,
) {
  const { pathname, search } = request.nextUrl;

  if (!user) {
    if (isPublic(pathname)) return response;
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(login);
  }

  // user_type is written into app_metadata by the handle_new_user trigger,
  // so routing costs no database query.
  const userType = (user.app_metadata?.user_type ?? "practice") as UserType;
  const home = HOME[userType] ?? "/practice";

  // Signed in and sitting on an auth page — send them where they belong.
  if (["/login", "/register", "/forgot-password"].some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  const area = pathname.split("/")[1];
  if (["practice", "locum", "admin"].includes(area) && area !== userType) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
