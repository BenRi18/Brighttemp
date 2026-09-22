"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/features/auth/session";
import { enqueue } from "@/features/notifications/enqueue";
import { approvalSchema, rateDecisionSchema, feeSchema, trustSchema } from "./schema";
import type { ActionState } from "@/features/auth/actions";

async function adminOnly() {
  const account = await requireAccount();
  if (!account.admin?.is_active) throw new Error("Not authorised");
  return account;
}

export async function reviewPractice(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = approvalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const account = await adminOnly();
  const supabase = await createClient();
  const approved = parsed.data.decision === "approve";

  const { data, error } = await supabase
    .from("practices")
    .update({
      status: approved ? "approved" : "rejected",
      approved_at: approved ? new Date().toISOString() : null,
      approved_by: approved ? account.profile.id : null,
      suspension_reason: approved ? null : parsed.data.reason || null,
    })
    .eq("id", parsed.data.id)
    .select("id, name, email, practice_users ( profile_id, profiles ( email ) )")
    .single();

  if (error) return { error: "We couldn't record that decision." };

  const owner = data.practice_users?.[0];
  if (owner?.profiles) {
    await enqueue(supabase, [
      {
        profileId: owner.profile_id,
        recipient: owner.profiles.email,
        event: approved ? "account_approved" : "account_rejected",
        subject: approved ? "Your practice is approved" : "About your Brighttemp registration",
        payload: { practice: data.name },
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

  const account = await adminOnly();
  const supabase = await createClient();
  const approved = parsed.data.decision === "approve";

  const { data, error } = await supabase
    .from("locums")
    .update({
      status: approved ? "approved" : "rejected",
      approved_at: approved ? new Date().toISOString() : null,
      approved_by: approved ? account.profile.id : null,
      suspension_reason: approved ? null : parsed.data.reason || null,
    })
    .eq("id", parsed.data.id)
    .select("id, is_bookable, profile_id, profiles!locums_profile_id_fkey ( email )")
    .single();

  if (error) return { error: "We couldn't record that decision." };

  if (data.profiles) {
    await enqueue(supabase, [
      {
        profileId: data.profile_id,
        recipient: data.profiles.email,
        event: approved ? "account_approved" : "account_rejected",
        subject: approved ? "You're approved on Brighttemp" : "About your Brighttemp registration",
      },
    ]);
  }

  revalidatePath("/admin/approvals");
  return {
    message: approved
      ? data.is_bookable
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
    if (error) return { error: "We couldn't record that decision." };
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
  return { message: "Fee updated. New bookings use it from today." };
}

export async function setTrustLevel(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = trustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  await adminOnly();
  const supabase = await createClient();
  const { error } = await supabase
    .from("practices")
    .update({ trust_level: parsed.data.trustLevel })
    .eq("id", parsed.data.practiceId);

  if (error) return { error: "We couldn't change that setting." };
  revalidatePath("/admin/approvals");
  return {
    message:
      parsed.data.trustLevel === "trusted"
        ? "Practice can now book instantly."
        : "Practice bookings will need approval.",
  };
}
