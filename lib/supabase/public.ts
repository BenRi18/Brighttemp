import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { resilientFetch } from "./fetch";

/**
 * Read-only client for PUBLIC data (the published fee table, the role list).
 *
 * Deliberately has no cookie handling. The normal server client reads cookies
 * to apply the signed-in user's policies, and touching cookies forces Next to
 * render that page per request — so a marketing page would hit the database
 * for every visitor. Without cookies the page can be cached and regenerated
 * on a timer instead.
 *
 * Never use this for anything a user owns: there is no session, so RLS sees an
 * anonymous caller.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: resilientFetch },
  });
}
