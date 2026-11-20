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

export type PostingPractice = {
  id: string;
  name: string;
  city: string | null;
  postcode: string;
  /** True for a practice Brighttemp runs by phone — no login, no portal. */
  isManaged: boolean;
};

/**
 * Practices an admin may post a shift for: approved, and with coordinates.
 *
 * A practice with no coordinates is left out deliberately. Its distance
 * cannot be measured, so locum_may_claim would wave its shifts through to
 * everyone regardless of how far away they are.
 */
export async function practicesForPosting(): Promise<PostingPractice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("practices_for_posting");

  if (error) {
    console.error("[practicesForPosting] failed:", error.message);
    return [];
  }

  return (data ?? []).map((p) => ({
    id: p.practice_id,
    name: p.name,
    city: p.city,
    postcode: p.postcode,
    isManaged: p.is_managed,
  }));
}

/** Every practice's shifts, for the agency view. Same shape as one practice's. */
export async function allShifts(): Promise<(PracticeShift & { practiceName: string })[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("open_shifts")
    .select(`
      id, shift_date, start_time, finish_time, hours, notes, status, booking_id,
      roles ( name ),
      practices ( name, is_managed ),
      shift_claims (
        id, locum_id, hourly_rate, message, status,
        locums ( years_experience, profiles!locums_profile_id_fkey ( full_name ) )
      )
    `)
    .order("shift_date", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[allShifts] failed:", error.message);
    return [];
  }

  return (data ?? []).map((s) => ({
    ...mapShift(s),
    practiceName: s.practices?.name ?? "—",
  }));
}

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

  return (data ?? []).map(mapShift);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Shared by both lists, so the two can never disagree about a shift. */
function mapShift(s: any): PracticeShift {
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
      .map((c: any) => ({
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
      .sort((a: ShiftClaimRow, b: ShiftClaimRow) => a.hourlyRate - b.hourlyRate),
  };
}
