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
    .select("id, fee_type, day_type, amount, effective_from, roles ( id, name, sort_order )")
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
