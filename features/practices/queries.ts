import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listFavourites(practiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("favourite_locums")
    .select(`
      locum_id, created_at,
      locums ( id, years_experience, is_bookable, base_postcode,
               profiles!locums_profile_id_fkey ( full_name ), roles ( name ) )
    `)
    .eq("practice_id", practiceId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function favouriteIds(practiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("favourite_locums")
    .select("locum_id")
    .eq("practice_id", practiceId);
  return new Set((data ?? []).map((r) => r.locum_id));
}

export async function listTeam(practiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("practice_users")
    .select("id, role, is_primary, profiles ( full_name, email, phone )")
    .eq("practice_id", practiceId);
  return data ?? [];
}
