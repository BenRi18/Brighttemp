import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";

/**
 * RLS already limits bookings to ones the caller is party to, so these
 * queries don't filter by practice or locum — doing it again here would be a
 * second source of truth that can fall out of step with the policies.
 */
const SELECT = `
  id, reference, booking_date, start_time, finish_time, hours, status,
  locum_hourly_rate, locum_total, booking_fee, same_day_surcharge, is_same_day,
  notes, requested_at, confirmed_at,
  roles ( name ),
  practices ( id, name, city, postcode ),
  locums ( id, years_experience, profiles!locums_profile_id_fkey ( id, full_name, phone, email ) )
`;

export async function listBookings(opts: { upcoming?: boolean; limit?: number } = {}) {
  const supabase = await createClient();
  let q = supabase.from("bookings").select(SELECT);

  if (opts.upcoming !== undefined) {
    q = opts.upcoming
      ? q.gte("booking_date", todayISO())
      : q.lt("booking_date", todayISO());
  }

  const { data, error } = await q
    .order("booking_date", { ascending: opts.upcoming ?? true })
    .limit(opts.limit ?? 50);

  if (error) {
    console.error("listBookings failed", error.message);
    return [];
  }
  return data ?? [];
}

export type BookingListItem = Awaited<ReturnType<typeof listBookings>>[number];

export async function getBooking(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("bookings").select(SELECT).eq("id", id).maybeSingle();
  return data;
}

export async function getBookingHistory(bookingId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("booking_status_history")
    .select("from_status, to_status, changed_at, reason")
    .eq("booking_id", bookingId)
    .order("changed_at");
  return data ?? [];
}

export async function countByStatus(status: "requested" | "confirmed") {
  const supabase = await createClient();
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", status);
  return count ?? 0;
}
