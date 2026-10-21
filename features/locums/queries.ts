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

// ---------------------------------------------------------------------
// Admin roster
// ---------------------------------------------------------------------

/** How many documents a locum is short, for the roster list. */
export type ComplianceSummary = {
  approved: number;
  outstanding: number;
  expiringSoon: number;
  expired: number;
};

export type RosterRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  roleId: string;
  status: string;
  isBookable: boolean;
  basePostcode: string;
  yearsExperience: number;
  gdcNumber: string | null;
  createdAt: string;
  compliance: ComplianceSummary;
};

/** The four values account_status can take. */
export const ACCOUNT_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
export type AccountStatusValue = (typeof ACCOUNT_STATUSES)[number];

export function isAccountStatus(v: string | undefined): v is AccountStatusValue {
  return v !== undefined && (ACCOUNT_STATUSES as readonly string[]).includes(v);
}

export type RosterFilters = {
  /** Matches name, email or GDC number. */
  q?: string;
  roleId?: string;
  status?: string;
  /** "yes" or "no" — whether they currently appear in practice search. */
  bookable?: string;
};

/** Hard ceiling so one page can never try to render the whole table. */
const ROSTER_LIMIT = 500;

/**
 * Every locum on the books, not just the ones waiting for approval.
 *
 * Role, status and bookability filter in the database. The text search runs
 * here instead, because it has to match either the person's name (on profiles)
 * or their GDC number (on locums), and PostgREST would AND those two rather
 * than OR them. Fine at agency scale; if the roster ever runs past a few
 * hundred this wants a database-side search instead.
 */
export async function listLocums(filters: RosterFilters = {}): Promise<{
  rows: RosterRow[];
  truncated: boolean;
}> {
  const supabase = await createClient();

  let query = supabase
    .from("locums")
    .select(`
      id, status, is_bookable, base_postcode, years_experience, gdc_number, created_at, role_id,
      profiles!locums_profile_id_fkey ( full_name, email, phone ),
      roles ( name )
    `)
    .limit(ROSTER_LIMIT);

  if (filters.roleId) query = query.eq("role_id", filters.roleId);
  if (isAccountStatus(filters.status)) query = query.eq("status", filters.status);
  if (filters.bookable === "yes") query = query.eq("is_bookable", true);
  if (filters.bookable === "no") query = query.eq("is_bookable", false);

  const { data, error } = await query;
  if (error) {
    console.error("[listLocums] failed:", error.message);
    return { rows: [], truncated: false };
  }

  const locums = data ?? [];
  const ids = locums.map((l) => l.id);

  // One query for everyone's documents rather than one per locum.
  const { data: documents } = ids.length
    ? await supabase
        .from("compliance_documents")
        .select("locum_id, status")
        .in("locum_id", ids)
        .eq("is_current", true)
    : { data: [] };

  const byLocum = new Map<string, ComplianceSummary>();
  for (const d of documents ?? []) {
    const s = byLocum.get(d.locum_id) ?? {
      approved: 0,
      outstanding: 0,
      expiringSoon: 0,
      expired: 0,
    };
    if (d.status === "approved") s.approved += 1;
    else if (d.status === "expiring_soon") s.expiringSoon += 1;
    else if (d.status === "expired") s.expired += 1;
    else s.outstanding += 1; // pending, under_review, rejected
    byLocum.set(d.locum_id, s);
  }

  const needle = filters.q?.trim().toLowerCase();

  const rows: RosterRow[] = locums
    .map((l) => ({
      id: l.id,
      name: l.profiles?.full_name ?? "Unnamed",
      email: l.profiles?.email ?? null,
      phone: l.profiles?.phone ?? null,
      role: l.roles?.name ?? "—",
      roleId: l.role_id,
      status: l.status,
      isBookable: l.is_bookable,
      basePostcode: l.base_postcode,
      yearsExperience: l.years_experience,
      gdcNumber: l.gdc_number,
      createdAt: l.created_at,
      compliance: byLocum.get(l.id) ?? {
        approved: 0,
        outstanding: 0,
        expiringSoon: 0,
        expired: 0,
      },
    }))
    .filter((r) =>
      !needle
        ? true
        : r.name.toLowerCase().includes(needle) ||
          (r.email?.toLowerCase().includes(needle) ?? false) ||
          (r.gdcNumber?.toLowerCase().includes(needle) ?? false),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

  return { rows, truncated: locums.length === ROSTER_LIMIT };
}

/** One locum's full record, for the admin detail page. */
export async function locumRecord(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locums")
    .select(`
      id, status, is_bookable, base_postcode, travel_radius_miles, years_experience,
      gdc_number, gdc_expiry, bio, specialisms, created_at, approved_at, suspension_reason,
      role_id,
      profiles!locums_profile_id_fkey ( full_name, first_name, last_name, email, phone, whatsapp_opt_in ),
      roles ( name )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("[locumRecord] failed:", error.message);
  return data ?? null;
}

/** The bookings a locum has had, newest first. */
export async function locumBookings(locumId: string, limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("id, booking_date, start_time, finish_time, status, practices ( name )")
    .eq("locum_id", locumId)
    .order("booking_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Every role, for the roster filter. */
export async function allRoles() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("id, name")
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}
