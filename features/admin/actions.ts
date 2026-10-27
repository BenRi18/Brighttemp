"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAccount } from "@/features/auth/session";
import { enqueue } from "@/features/notifications/enqueue";
import {
  approvalSchema,
  rateDecisionSchema,
  feeSchema,
  flatFeeSchema,
  trustSchema,
  archiveSchema,
  deleteLocumSchema,
} from "./schema";
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

/**
 * Take a locum off the books without destroying anything.
 *
 * For anyone who has actually worked: their bookings and the invoices raised
 * against them have to survive, so this only sets archived_at. They drop out
 * of practice search immediately and off the default roster view.
 */
export async function archiveLocum(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = archiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  await adminOnly();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_archive_locum", {
    p_locum_id: parsed.data.locumId,
    p_reason: parsed.data.reason || null,
  });

  if (error) {
    console.error("[archiveLocum] failed:", error.message);
    return { error: removalErrorMessage(error.message) };
  }

  const row = Array.isArray(data) ? data[0] : null;
  revalidatePath("/admin/locums");
  revalidatePath(`/admin/locums/${parsed.data.locumId}`);
  return {
    message: `${row?.full_name ?? "That locum"} is archived. Their bookings and invoices are untouched.`,
  };
}

export async function unarchiveLocum(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = archiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  await adminOnly();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_unarchive_locum", {
    p_locum_id: parsed.data.locumId,
  });

  if (error) {
    console.error("[unarchiveLocum] failed:", error.message);
    return { error: removalErrorMessage(error.message) };
  }

  const row = Array.isArray(data) ? data[0] : null;
  revalidatePath("/admin/locums");
  revalidatePath(`/admin/locums/${parsed.data.locumId}`);
  return {
    message: row?.is_bookable
      ? "Back on the books and in practice search."
      : "Back on the books. They won't appear in search until their documents are in date again.",
  };
}

/**
 * Delete a locum who never worked a shift — permanently.
 *
 * Only reachable for a locum with no bookings at all; bookings.locum_id is
 * `on delete restrict`, so Postgres would refuse anyway, but we check first so
 * the admin gets a sentence rather than a constraint error.
 *
 * The order matters. Certificates go before the login, because the cascade
 * removes the compliance_documents rows but not the PDFs they point at: delete
 * the account first and a failure here would leave files in the bucket with
 * nothing in the database recording that they exist. This way round, the worst
 * case is an account that survives with its uploads gone, which the locum can
 * simply upload again.
 */
export async function deleteLocum(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = deleteLocumSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Tick the confirmation box before deleting." };

  const account = await adminOnly();
  const supabase = await createClient();
  const { locumId } = parsed.data;

  // Checked against the database, not against the page that drew the button —
  // it may have been open a while, and they may have taken a booking since.
  const { data, error } = await supabase.rpc("locum_delete_check", { p_locum_id: locumId });
  if (error) {
    console.error("[deleteLocum] eligibility check failed:", error.message);
    return { error: removalErrorMessage(error.message) };
  }

  const check = Array.isArray(data) ? data[0] : null;
  if (!check) return { error: "That locum no longer exists — refresh the page." };

  if (!check.can_delete) {
    const n = check.bookings_total;
    return {
      error:
        `${check.full_name} has ${n} booking${n === 1 ? "" : "s"} on record, so the account ` +
        `can't be deleted — those bookings and any invoices against them are financial ` +
        `records. Archive them instead: they come out of search straight away and the ` +
        `history stays.`,
    };
  }

  const { data: docs, error: docsError } = await supabase
    .from("compliance_documents")
    .select("storage_path")
    .eq("locum_id", locumId);

  if (docsError) {
    console.error("[deleteLocum] could not list certificates:", docsError.message);
    return { error: "We couldn't read their uploaded documents, so nothing was deleted." };
  }

  const paths = (docs ?? []).map((d) => d.storage_path).filter(Boolean);
  const admin = createAdminClient();

  // Written while there is still something to write about. Keeps who deleted
  // whom, and when — the audit row outlives the account by design.
  const { error: auditError } = await admin.from("audit_log").insert({
    actor_id: account.profile.id,
    actor_type: "admin",
    action: "locum.deleted",
    entity_type: "locum",
    entity_id: locumId,
    before: {
      full_name: check.full_name,
      email: check.email,
      documents: check.documents,
    },
  });
  if (auditError) {
    console.error("[deleteLocum] audit write failed:", auditError.message);
    return { error: "We couldn't record the deletion, so nothing was deleted. Try again." };
  }

  if (paths.length > 0) {
    const { error: storageError } = await admin.storage.from("compliance").remove(paths);
    if (storageError) {
      console.error("[deleteLocum] certificates not removed:", storageError.message);
      return {
        error: "We couldn't remove their uploaded certificates, so nothing else was deleted. Try again.",
      };
    }
  }

  const { error: authError } = await admin.auth.admin.deleteUser(check.profile_id);
  if (authError) {
    console.error("[deleteLocum] auth user not deleted:", authError.message);
    return {
      error:
        "Their certificates were removed but the account itself wasn't — try again, " +
        "and if it keeps failing send me the time it happened.",
    };
  }

  revalidatePath("/admin/locums");
  revalidatePath("/admin/approvals");
  redirect(`/admin/locums?removed=${encodeURIComponent(check.full_name ?? "Locum")}`);
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

/**
 * Archiving and deleting have their own messages, because the two that matter
 * most — an upcoming shift, and the booking history that makes a delete
 * impossible — are raised by the database and need passing through intact.
 */
function removalErrorMessage(message: string): string {
  if (/could not find the function|schema cache/i.test(message)) {
    return "The database is missing an update — run migration 0013_archive_and_delete_locums.sql in Supabase.";
  }
  // Raised by admin_archive_locum, already written for a person to read.
  if (/still to work|already archived|is not archived|not found/i.test(message)) {
    return message.replace(/^.*?:\s*/, "");
  }
  if (/not authorised|permission denied/i.test(message)) {
    return "Your account doesn't have permission for that. Sign out and back in, then try again.";
  }
  if (/violates foreign key constraint/i.test(message)) {
    return "They have bookings on record, so the account can't be deleted. Archive them instead.";
  }
  return process.env.NODE_ENV === "development"
    ? `Failed: ${message}`
    : "That didn't go through. Try again.";
}
