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
  /** Last time they signed in. Null means they never have. */
  lastSeenAt: string | null;
  /** Every booking ever, whatever its status — a cancellation counts. */
  bookings: number;
  archivedAt: string | null;
  compliance: ComplianceSummary;
};

/**
 * How long without signing in before a locum counts as dormant. Ninety days
 * is roughly a quarter: long enough that a working locum with a quiet spell
 * isn't swept up, short enough to catch a registration that went nowhere.
 */
export const DORMANT_AFTER_DAYS = 90;

/**
 * Dormant means nothing is lost by removing them: no booking has ever been
 * made, and they haven't signed in for a quarter — or have never signed in
 * at all, which is the commonest case by far.
 */
export function isDormant(row: Pick<RosterRow, "bookings" | "lastSeenAt">): boolean {
  if (row.bookings > 0) return false;
  if (!row.lastSeenAt) return true;
  const days = (Date.now() - new Date(row.lastSeenAt).getTime()) / 86_400_000;
  return days >= DORMANT_AFTER_DAYS;
}

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
  /** "dormant" narrows to the ones safe to remove. */
  activity?: string;
  /** Archived locums are off the roster unless this is asked for. */
  includeArchived?: boolean;
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
  /**
   * False when sign-in history couldn't be read — the page then hides the
   * column rather than showing "Never" for everybody.
   */
  activityKnown: boolean;
}> {
  const supabase = await createClient();

  let query = supabase
    .from("locums")
    .select(`
      id, status, is_bookable, base_postcode, years_experience, gdc_number, created_at,
      role_id, archived_at,
      profiles!locums_profile_id_fkey ( full_name, email, phone, last_seen_at ),
      roles ( name )
    `)
    .limit(ROSTER_LIMIT);

  if (filters.roleId) query = query.eq("role_id", filters.roleId);
  if (isAccountStatus(filters.status)) query = query.eq("status", filters.status);
  if (filters.bookable === "yes") query = query.eq("is_bookable", true);
  if (filters.bookable === "no") query = query.eq("is_bookable", false);
  if (!filters.includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query;
  if (error) {
    console.error("[listLocums] failed:", error.message);
    return { rows: [], truncated: false, activityKnown: false };
  }

  const locums = data ?? [];
  const ids = locums.map((l) => l.id);

  // One query for everyone's documents rather than one per locum, and one
  // for sign-ins and booking counts — the latter through a function because
  // the last sign-in lives in auth.users, which the app's role cannot read.
  const [{ data: documents }, activity] = await Promise.all([
    ids.length
      ? supabase
          .from("compliance_documents")
          .select("locum_id, status")
          .in("locum_id", ids)
          .eq("is_current", true)
      : Promise.resolve({ data: [] as { locum_id: string; status: string }[] }),
    supabase.rpc("admin_locum_activity"),
  ]);

  // If the function isn't there yet, we know nothing about sign-ins — and
  // saying "never signed in" when the truth is "we didn't ask" would mark
  // the whole roster dormant. Report it as unknown instead.
  const activityKnown = !activity.error;
  if (activity.error) {
    console.error("[listLocums] activity unavailable:", activity.error.message);
  }

  const signIns = new Map<string, string | null>();
  const bookingCounts = new Map<string, number>();
  for (const a of activity.data ?? []) {
    signIns.set(a.locum_id, a.last_sign_in_at);
    bookingCounts.set(a.locum_id, a.bookings_total ?? 0);
  }

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
      lastSeenAt: signIns.get(l.id) ?? null,
      bookings: bookingCounts.get(l.id) ?? 0,
      archivedAt: l.archived_at ?? null,
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
    .filter((r) => (filters.activity === "dormant" && activityKnown ? isDormant(r) : true))
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

  return { rows, truncated: locums.length === ROSTER_LIMIT, activityKnown };
}

/** One locum's full record, for the admin detail page. */
export async function locumRecord(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("locums")
    .select(`
      id, status, is_bookable, base_postcode, travel_radius_miles, years_experience,
      gdc_number, gdc_expiry, bio, specialisms, created_at, approved_at, suspension_reason,
      role_id, archived_at, archive_reason,
      profiles!locums_profile_id_fkey (
        full_name, first_name, last_name, email, phone, whatsapp_opt_in, last_seen_at
      ),
      roles ( name )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("[locumRecord] failed:", error.message);
  return data ?? null;
}

export type RemovalCheck = {
  bookingsTotal: number;
  bookingsUpcoming: number;
  documents: number;
  canDelete: boolean;
  /** The database refused to answer — offer nothing rather than guess. */
  unavailable?: string;
};

/**
 * What can be done with this locum: deleted outright, or only archived.
 * Answered by the database so the page and the action agree, and so the
 * count includes bookings an admin's own policies wouldn't let them read.
 */
export async function locumRemovalCheck(locumId: string): Promise<RemovalCheck> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("locum_delete_check", { p_locum_id: locumId });

  if (error) {
    console.error("[locumRemovalCheck] failed:", error.message);
    return {
      bookingsTotal: 0,
      bookingsUpcoming: 0,
      documents: 0,
      canDelete: false,
      unavailable: /could not find the function|schema cache/i.test(error.message)
        ? "Run migration 0013_archive_and_delete_locums.sql in Supabase to enable this."
        : "We couldn't check this locum's booking history just now.",
    };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return {
      bookingsTotal: 0,
      bookingsUpcoming: 0,
      documents: 0,
      canDelete: false,
      unavailable: "That locum no longer exists.",
    };
  }

  return {
    bookingsTotal: row.bookings_total ?? 0,
    bookingsUpcoming: row.bookings_upcoming ?? 0,
    documents: row.documents ?? 0,
    canDelete: Boolean(row.can_delete),
  };
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
