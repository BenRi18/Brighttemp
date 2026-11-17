import "server-only";
import { createClient } from "@/lib/supabase/server";

export type BoardShift = {
  shiftId: string;
  practiceName: string;
  practiceCity: string | null;
  roleName: string;
  shiftDate: string;
  startTime: string;
  finishTime: string;
  hours: number;
  notes: string | null;
  distanceMiles: number | null;
  /** Their approved rate for that day type. Null means they have none yet. */
  yourRate: number | null;
  yourTotal: number | null;
  alreadyClaimed: boolean;
};

/**
 * The board, as this locum sees it: shifts they could actually take.
 *
 * Eligibility is decided in the database — right role, bookable, in range,
 * not already working then — so the page cannot accidentally show a shift
 * that would be refused on the way in.
 */
export async function shiftsForLocum(locumId: string): Promise<BoardShift[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_shifts_for_locum", {
    p_locum_id: locumId,
  });

  if (error) {
    console.error("[shiftsForLocum] failed:", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    shiftId: r.shift_id,
    practiceName: r.practice_name,
    practiceCity: r.practice_city,
    roleName: r.role_name,
    shiftDate: r.shift_date,
    startTime: r.start_time,
    finishTime: r.finish_time,
    hours: Number(r.hours),
    notes: r.notes,
    distanceMiles: r.distance_miles,
    yourRate: r.your_rate === null ? null : Number(r.your_rate),
    yourTotal: r.your_total === null ? null : Number(r.your_total),
    alreadyClaimed: r.already_claimed,
  }));
}

export type ShiftClaimRow = {
  claimId: string;
  locumId: string;
  name: string;
  yearsExperience: number;
  hourlyRate: number;
  total: number;
  message: string | null;
  status: string;
};

export type PracticeShift = {
  id: string;
  roleName: string;
  shiftDate: string;
  startTime: string;
  finishTime: string;
  hours: number;
  notes: string | null;
  status: string;
  bookingId: string | null;
  claims: ShiftClaimRow[];
};

/** The practice's own shifts, newest gap first, with everyone who offered. */
export async function shiftsForPractice(practiceId: string): Promise<PracticeShift[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("open_shifts")
    .select(`
      id, shift_date, start_time, finish_time, hours, notes, status, booking_id,
      roles ( name ),
      shift_claims (
        id, locum_id, hourly_rate, message, status,
        locums ( years_experience, profiles!locums_profile_id_fkey ( full_name ) )
      )
    `)
    .eq("practice_id", practiceId)
    .order("shift_date", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[shiftsForPractice] failed:", error.message);
    return [];
  }

  return (data ?? []).map((s) => {
    const hours = Number(s.hours);
    return {
      id: s.id,
      roleName: s.roles?.name ?? "—",
      shiftDate: s.shift_date,
      startTime: s.start_time,
      finishTime: s.finish_time,
      hours,
      notes: s.notes,
      status: s.status,
      bookingId: s.booking_id,
      claims: (s.shift_claims ?? [])
        .map((c) => ({
          claimId: c.id,
          locumId: c.locum_id,
          name: c.locums?.profiles?.full_name ?? "Unnamed",
          yearsExperience: c.locums?.years_experience ?? 0,
          hourlyRate: Number(c.hourly_rate),
          total: Math.round(Number(c.hourly_rate) * hours * 100) / 100,
          message: c.message,
          status: c.status,
        }))
        // Cheapest first: with no rate on the post, cost is the thing the
        // practice is comparing, and it should not have to hunt for it.
        .sort((a, b) => a.hourlyRate - b.hourlyRate),
    };
  });
}
