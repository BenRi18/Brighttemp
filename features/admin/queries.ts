import "server-only";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";

export async function pendingPractices() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("practices")
    .select("id, name, city, postcode, email, phone, created_at, status")
    .eq("status", "pending")
    .order("created_at");
  return data ?? [];
}

export async function currentFees() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fees")
    .select("id, fee_type, day_type, amount, notice_hours_below, effective_from, roles ( id, name, sort_order )")
    .is("effective_to", null)
    .order("effective_from", { ascending: false });
  return data ?? [];
}

/** Numbers for the admin landing page. Head-only counts, so no rows travel. */
export async function adminStats() {
  const supabase = await createClient();
  const today = todayISO();

  const [practices, locums, documents, todayBookings, unpaid] = await Promise.all([
    supabase.from("practices").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("locums").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("compliance_documents")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "under_review"]),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("booking_date", today),
    supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["sent", "overdue"]),
  ]);

  return {
    pendingPractices: practices.count ?? 0,
    pendingLocums: locums.count ?? 0,
    pendingDocuments: documents.count ?? 0,
    bookingsToday: todayBookings.count ?? 0,
    unpaidInvoices: unpaid.count ?? 0,
  };
}

/** Documents expiring inside the warning window — the proactive chase list. */
export async function expiringDocuments(days = 30) {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  const { data } = await supabase
    .from("compliance_documents")
    .select(`
      id, doc_type, expiry_date, status,
      locums ( id, profiles!locums_profile_id_fkey ( full_name, email ) )
    `)
    .eq("is_current", true)
    .not("expiry_date", "is", null)
    .lte("expiry_date", cutoff.toISOString().slice(0, 10))
    .order("expiry_date");
  return data ?? [];
}

// ---------------------------------------------------------------------
// Practice roster
// ---------------------------------------------------------------------

export type PracticeRosterRow = {
  id: string;
  name: string;
  tradingName: string | null;
  city: string;
  postcode: string;
  email: string | null;
  phone: string | null;
  status: string;
  trustLevel: string;
  createdAt: string;
  userCount: number;
  bookingCount: number;
  unpaidInvoices: number;
};

export type PracticeFilters = {
  /** Matches practice name, trading name, email or postcode. */
  q?: string;
  status?: string;
  trustLevel?: string;
};

const PRACTICE_LIMIT = 500;

export const ACCOUNT_STATUSES = ["pending", "approved", "rejected", "suspended"] as const;
type AccountStatusValue = (typeof ACCOUNT_STATUSES)[number];
const isAccountStatus = (v: string | undefined): v is AccountStatusValue =>
  v !== undefined && (ACCOUNT_STATUSES as readonly string[]).includes(v);

/**
 * Every practice on the books. Same shape as the locum roster: status and
 * trust level filter in the database, the text search runs here because it has
 * to match several columns with OR rather than AND.
 */
export async function listPractices(filters: PracticeFilters = {}): Promise<{
  rows: PracticeRosterRow[];
  truncated: boolean;
}> {
  const supabase = await createClient();

  let query = supabase
    .from("practices")
    .select(`
      id, name, trading_name, city, postcode, email, phone, status, trust_level, created_at
    `)
    .limit(PRACTICE_LIMIT);

  if (isAccountStatus(filters.status)) query = query.eq("status", filters.status);
  if (filters.trustLevel === "new" || filters.trustLevel === "trusted") {
    query = query.eq("trust_level", filters.trustLevel);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[listPractices] failed:", error.message);
    return { rows: [], truncated: false };
  }

  const practices = data ?? [];
  const ids = practices.map((p) => p.id);

  // Three tallies, one query each, rather than three per practice.
  const [{ data: users }, { data: bookings }, { data: invoices }] = ids.length
    ? await Promise.all([
        supabase.from("practice_users").select("practice_id").in("practice_id", ids),
        supabase.from("bookings").select("practice_id").in("practice_id", ids),
        supabase
          .from("invoices")
          .select("practice_id")
          .in("practice_id", ids)
          .in("status", ["sent", "overdue"]),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const tally = (rows: { practice_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.practice_id, (m.get(r.practice_id) ?? 0) + 1);
    return m;
  };
  const userCounts = tally(users);
  const bookingCounts = tally(bookings);
  const invoiceCounts = tally(invoices);

  const needle = filters.q?.trim().toLowerCase();

  const rows = practices
    .map((p) => ({
      id: p.id,
      name: p.name,
      tradingName: p.trading_name,
      city: p.city,
      postcode: p.postcode,
      email: p.email,
      phone: p.phone,
      status: p.status,
      trustLevel: p.trust_level,
      createdAt: p.created_at,
      userCount: userCounts.get(p.id) ?? 0,
      bookingCount: bookingCounts.get(p.id) ?? 0,
      unpaidInvoices: invoiceCounts.get(p.id) ?? 0,
    }))
    .filter((r) =>
      !needle
        ? true
        : r.name.toLowerCase().includes(needle) ||
          (r.tradingName?.toLowerCase().includes(needle) ?? false) ||
          (r.email?.toLowerCase().includes(needle) ?? false) ||
          r.postcode.toLowerCase().includes(needle) ||
          r.city.toLowerCase().includes(needle),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));

  return { rows, truncated: practices.length === PRACTICE_LIMIT };
}

/** One practice's full record. */
export async function practiceRecord(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("practices")
    .select(`
      id, name, trading_name, address_line1, address_line2, city, postcode,
      phone, email, cqc_provider_id, status, trust_level,
      billing_email, billing_address, vat_number, payment_terms_days, purchase_order_required,
      approved_at, suspension_reason, created_at
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) console.error("[practiceRecord] failed:", error.message);
  return data ?? null;
}

/** Who at the practice can sign in. */
export async function practiceTeam(practiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("practice_users")
    .select("id, role, is_primary, accepted_at, profiles ( full_name, email, phone )")
    .eq("practice_id", practiceId)
    .order("is_primary", { ascending: false });
  return data ?? [];
}

/** Their recent bookings, newest first. */
export async function practiceBookings(practiceId: string, limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select(`
      id, booking_date, start_time, finish_time, status,
      locums ( profiles!locums_profile_id_fkey ( full_name ) )
    `)
    .eq("practice_id", practiceId)
    .order("booking_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Their invoices, newest first. */
export async function practiceInvoices(practiceId: string, limit = 10) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, issue_date, due_date, total, status")
    .eq("practice_id", practiceId)
    .order("issue_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}
