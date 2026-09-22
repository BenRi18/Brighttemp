import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SearchResult, Practice } from "@/lib/database.types";
import type { SearchInput } from "./schema";

export type SearchOutcome =
  | { ok: true; results: SearchResult[] }
  | { ok: false; reason: "no_coordinates" | "failed" };

/**
 * Wraps the search_locums RPC. All the real filtering — compliance, distance,
 * the locum's own travel radius, clashing bookings — happens in the database,
 * so this cannot drift from the booking rules.
 */
export async function searchLocums(
  practice: Practice,
  input: SearchInput,
): Promise<SearchOutcome> {
  if (practice.latitude == null || practice.longitude == null) {
    return { ok: false, reason: "no_coordinates" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_locums", {
    p_role_id: input.roleId,
    p_date: input.date,
    p_start: input.startTime,
    p_finish: input.finishTime,
    p_latitude: practice.latitude,
    p_longitude: practice.longitude,
    p_max_miles: input.maxMiles,
    p_min_years: input.minYears,
  });

  if (error) {
    console.error("search_locums failed", error.message);
    return { ok: false, reason: "failed" };
  }

  return { ok: true, results: data ?? [] };
}

export async function listRoles() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}
