"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/features/auth/session";
import { enqueue } from "@/features/notifications/enqueue";
import { z } from "zod";
import type { ActionState } from "@/features/auth/actions";

const issueSchema = z.object({ invoiceId: z.string().uuid() });
const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  method: z.enum(["bank_transfer", "card", "direct_debit", "other"]),
  reference: z.string().trim().max(60).optional().or(z.literal("")),
});

/** Draft → sent. Queues the invoice email at the same time. */
export async function issueInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = issueSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const account = await requireAccount();
  if (!account.admin) return { error: "Not authorised." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", parsed.data.invoiceId)
    .eq("status", "draft")
    .select("id, invoice_number, total, practices ( id, name, billing_email, email )")
    .single();

  if (error) return { error: "We couldn't issue that invoice." };

  const to = data.practices?.billing_email ?? data.practices?.email;
  if (to) {
    await enqueue(supabase, [
      {
        profileId: null,
        recipient: to,
        event: "invoice_issued",
        subject: `Brighttemp invoice ${data.invoice_number}`,
        invoiceId: data.id,
        payload: { total: data.total },
      },
    ]);
  }

  revalidatePath("/admin/invoices");
  return { message: `Invoice ${data.invoice_number} issued.` };
}

export async function recordPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const account = await requireAccount();
  if (!account.admin) return { error: "Not authorised." };

  const supabase = await createClient();
  const { error } = await supabase.from("payments").insert({
    invoice_id: parsed.data.invoiceId,
    amount: parsed.data.amount,
    method: parsed.data.method,
    reference: parsed.data.reference || null,
    recorded_by: account.profile.id,
  });

  if (error) return { error: "We couldn't record that payment." };

  // Full settlement closes the invoice. Partial payments leave it open.
  const [{ data: invoice }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("total").eq("id", parsed.data.invoiceId).single(),
    supabase.from("payments").select("amount").eq("invoice_id", parsed.data.invoiceId),
  ]);

  const paid = (payments ?? []).reduce((t, p) => t + Number(p.amount), 0);
  if (invoice && paid >= Number(invoice.total)) {
    await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", parsed.data.invoiceId);
  }

  revalidatePath("/admin/invoices");
  return { message: "Payment recorded." };
}
