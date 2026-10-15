"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/features/auth/session";
import { enqueue } from "@/features/notifications/enqueue";
import { approvalSchema, rateDecisionSchema, feeSchema, flatFeeSchema, trustSchema } from "./schema";
import type { ActionState } from "@/features/auth/actions";

async function adminOnly() {
  const account = await requireAccount();
  if (!account.admin?.is_active) throw new Error("Not authorised");
  return account;
}

export async function reviewPractice(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = approvalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  await adminOnly();
  const supabase = await createClient();
  const approved = parsed.data.decision === "approve";

  // Through an admin-only database function: the sensitive columns are not
  // writable by the authenticated role at all (see 0009_admin_review_functions).
  const { data, error } = await supabase.rpc("admin_review_practice", {
    p_practice_id: parsed.data.id,
    p_approve: approved,
    p_reason: parsed.data.reason || null,
  });

  if (error) {
    console.error("[reviewPractice] failed:", error.message);
    return { error: adminErrorMessage(error.message) };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (row?.owner_email) {
    await enqueue(supabase, [
      {
        profileId: row.owner_profile_id,
        recipient: row.owner_email,
        event: approved ? "account_approved" : "account_rejected",
        subject: approved ? "Your practice is approved" : "About your Brighttemp registration",
        payload: { practice: row.name },
      },
    ]);
  }

  revalidatePath("/admin/approvals");
  return { message: approved ? "Practice approved." : "Practice rejected." };
}

/**
 * Approving a locum does not by itself put them in search — is_bookable also
 * requires every mandatory document to be approved and in date. The trigger
 * recomputes it; we just set status.
 */
export async function reviewLocum(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = approvalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  await adminOnly();
  const supabase = await createClient();
  const approved = parsed.data.decision === "approve";

  const { data, error } = await supabase.rpc("admin_review_locum", {
    p_locum_id: parsed.data.id,
    p_approve: approved,
    p_reason: parsed.data.reason || null,
  });

  if (error) {
    console.error("[reviewLocum] failed:", error.message);
    return { error: adminErrorMessage(error.message) };
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (row?.email) {
    await enqueue(supabase, [
      {
        profileId: row.profile_id,
        recipient: row.email,
        event: approved ? "account_approved" : "account_rejected",
        subject: approved ? "You're approved on Brighttemp" : "About your Brighttemp registration",
      },
    ]);
  }

  revalidatePath("/admin/approvals");
  return {
    message: approved
      ? row?.is_bookable
        ? "Locum approved and now visible in search."
        : "Locum approved. They won't appear in search until their documents are cleared."
      : "Locum rejected.",
  };
}

export async function reviewRateChange(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = rateDecisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const account = await adminOnly();
  const supabase = await createClient();

  if (parsed.data.decision === "reject") {
    const { error } = await supabase
      .from("locum_rates")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: account.profile.id,
        review_note: parsed.data.note || null,
      })
      .eq("id", parsed.data.rateId);
    if (error) {
      console.error("[reviewRateChange] failed:", error.message);
      return { error: adminErrorMessage(error.message) };
    }
    revalidatePath("/admin/approvals");
    return { message: "Rate change rejected." };
  }

  const { data: pending } = await supabase
    .from("locum_rates")
    .select("locum_id, day_type")
    .eq("id", parsed.data.rateId)
    .single();
  if (!pending) return { error: "That rate request no longer exists." };

  // Retire the live rate first — the partial unique index allows only one
  // approved, open-ended row per locum and day type.
  await supabase
    .from("locum_rates")
    .update({ status: "superseded", effective_to: new Date().toISOString().slice(0, 10) })
    .eq("locum_id", pending.locum_id)
    .eq("day_type", pending.day_type)
    .eq("status", "approved")
    .is("effective_to", null);

  const { error } = await supabase
    .from("locum_rates")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: account.profile.id,
    })
    .eq("id", parsed.data.rateId);

  if (error) return { error: "We couldn't approve that rate." };
  revalidatePath("/admin/approvals");
  return { message: "Rate change approved." };
}

/**
 * Fee changes close the old row and open a new one rather than editing in
 * place, so historical bookings keep the fee they were actually charged.
 */
export async function updateFee(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = feeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const account = await adminOnly();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  await supabase
    .from("fees")
    .update({ effective_to: today })
    .eq("fee_type", "booking")
    .eq("role_id", parsed.data.roleId)
    .eq("day_type", parsed.data.dayType)
    .is("effective_to", null);

  const { error } = await supabase.from("fees").insert({
    fee_type: "booking",
    role_id: parsed.data.roleId,
    day_type: parsed.data.dayType,
    amount: parsed.data.amount,
    effective_from: today,
    created_by: account.profile.id,
  });

  if (error) return { error: "We couldn't update that fee." };
  revalidatePath("/admin/fees");
  revalidatePath("/pricing");
  return { message: "Fee updated. New bookings use it from today." };
}

/**
 * The same-day surcharge and the cancellation fee. Like booking fees, the
 * current row is closed and a new one opened, so bookings already made keep
 * the fee they were quoted.
 */
export async function updateFlatFee(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = flatFeeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const account = await adminOnly();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { feeType, amount, noticeHoursBelow } = parsed.data;

  if (feeType === "cancellation" && !noticeHoursBelow) {
    return { fieldErrors: { noticeHoursBelow: ["Set the notice window this fee applies inside"] } };
  }

  await supabase
    .from("fees")
    .update({ effective_to: today })
    .eq("fee_type", feeType)
    .is("effective_to", null);

  const { error } = await supabase.from("fees").insert({
    fee_type: feeType,
    amount,
    notice_hours_below: feeType === "cancellation" ? noticeHoursBelow : null,
    effective_from: today,
    created_by: account.profile.id,
  });

  if (error) return { error: "We couldn't update that fee." };
  revalidatePath("/admin/fees");
  revalidatePath("/pricing");
  return {
    message:
      feeType === "same_day_surcharge"
        ? "Same-day surcharge updated."
        : "Cancellation fee updated.",
  };
}

export async function setTrustLevel(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = trustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  await adminOnly();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_trust_level", {
    p_practice_id: parsed.data.practiceId,
    p_trust_level: parsed.data.trustLevel,
  });

  if (error) {
    console.error("[setTrustLevel] failed:", error.message);
    return { error: adminErrorMessage(error.message) };
  }

  revalidatePath("/admin/approvals");
  return {
    message:
      parsed.data.trustLevel === "trusted"
        ? "Practice can now book instantly."
        : "Practice bookings will need approval.",
  };
}

/** Database errors, in words an admin can act on. */
function adminErrorMessage(message: string): string {
  // PostgREST says this when the function isn't in the database yet.
  if (/could not find the function|does not exist|schema cache/i.test(message)) {
    return "The database is missing an update — run migration 0009_admin_review_functions.sql in Supabase.";
  }
  if (/not authorised|permission denied/i.test(message)) {
    return "Your account doesn't have permission for that. Sign out and back in, then try again.";
  }
  if (/not found/i.test(message)) {
    return "That record no longer exists — refresh the page.";
  }
  return process.env.NODE_ENV === "development"
    ? `Failed: ${message}`
    : "We couldn't record that decision. Try again.";
}
