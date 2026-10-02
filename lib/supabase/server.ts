import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { mockModeEnabled, createMockClient, parseMockRole, MOCK_ROLE_COOKIE } from "./mock";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

type ServerClient = ReturnType<typeof createServerClient<Database>>;

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Runs as the signed-in user, so every query is subject to RLS.
 */
export async function createClient(): Promise<ServerClient> {
  const cookieStore = await cookies();

  // Preview mode (development only): answer from sample data instead of Supabase.
  if (mockModeEnabled()) {
    const role = parseMockRole(cookieStore.get(MOCK_ROLE_COOKIE)?.value);
    return createMockClient(role) as ServerClient;
  }

  return createServerClient<Database>(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, which cannot write cookies.
            // The middleware refreshes the session instead — safe to ignore.
          }
        },
      },
    },
  );
}
