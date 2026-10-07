import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";
import { resilientFetch } from "./fetch";

/**
 * Service-role client. Bypasses RLS entirely.
 *
 * Only for work that has no user session: the notification sender, the
 * nightly compliance job, invoice chasing. Never import this into anything
 * that renders. Anything a signed-in admin does should go through the
 * normal server client so their own policies and the audit log apply.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: resilientFetch },
  });
}
