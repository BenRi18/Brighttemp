import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function listInvoices(limit = 50) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(`
      id, invoice_number, issue_date, due_date, subtotal, vat_amount, total, status, paid_at,
      practices ( name ),
      bookings ( reference, booking_date )
    `)
    .order("issue_date", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function invoiceTotals() {
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("total, status");
  const rows = data ?? [];
  const sum = (statuses: string[]) =>
    rows.filter((r) => statuses.includes(r.status)).reduce((t, r) => t + Number(r.total ?? 0), 0);
  return { outstanding: sum(["sent", "overdue"]), paid: sum(["paid"]) };
}
