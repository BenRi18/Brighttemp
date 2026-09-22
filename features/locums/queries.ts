import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayISO, addDaysISO } from "@/lib/format";

export async function listAvailability(locumId: string, days = 60) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locum_availability")
    .select("id, available_on, is_available, start_time, finish_time, note")
    .eq("locum_id", locumId)
    .gte("available_on", todayISO())
    .lte("available_on", addDaysISO(days))
    .order("available_on");
  return data ?? [];
}

export async function listRates(locumId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locum_rates")
    .select("id, day_type, hourly_rate, status, effective_from, review_note")
    .eq("locum_id", locumId)
    .is("effective_to", null)
    .order("day_type");
  return data ?? [];
}

/** Locums awaiting approval, for the admin queue. */
export async function pendingLocums() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locums")
    .select(`
      id, status, base_postcode, years_experience, gdc_number, created_at, is_bookable,
      profiles!locums_profile_id_fkey ( full_name, email, phone ),
      roles ( name )
    `)
    .eq("status", "pending")
    .order("created_at");
  return data ?? [];
}

export async function pendingRateRequests() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("locum_rates")
    .select(`
      id, day_type, hourly_rate, requested_at,
      locums ( id, profiles!locums_profile_id_fkey ( full_name ) )
    `)
    .eq("status", "pending")
    .order("requested_at");
  return data ?? [];
}
