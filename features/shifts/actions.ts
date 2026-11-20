"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requirePractice, requireLocum, requirePracticeOrAdmin } from "@/features/auth/session";
import {
  postShiftSchema,
  claimShiftSchema,
  shiftIdSchema,
  awardShiftSchema,
} from "./schema";
import type { ActionState } from "@/features/auth/actions";

const invalid = (e: z.ZodError): ActionState => ({
  fieldErrors: e.flatten().fieldErrors as Record<string, string[]>,
});

/**
 * Post a gap.
 *
 * No rate goes on it. The insert is a plain one rather than a function
 * because the column grant is narrow — a practice may write the five fields
 * that describe the shift and nothing else, so status and booking_id cannot
 * be set from a form.
 */
export async function postShift(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = postShiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const account = await requirePractice();
  const supabase = await createClient();

  const { error } = await supabase.from("open_shifts").insert({
    practice_id: account.practice.practice.id,
    role_id: parsed.data.roleId,
    shift_date: parsed.data.shiftDate,
    start_time: parsed.data.startTime,
    finish_time: parsed.data.finishTime,
    notes: parsed.data.notes || null,
    created_by: account.profile.id,
  });

  if (error) {
    console.error("[postShift] failed:", error.message);
    return { error: shiftErrorMessage(error.message) };
  }

  revalidatePath("/practice/shifts");
  return {
    message: "Posted. Locums who can cover it have been told — you'll hear as they offer.",
  };
}

export async function withdrawShift(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = shiftIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  await requirePracticeOrAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("withdraw_shift", { p_shift_id: parsed.data.shiftId });
  if (error) {
    console.error("[withdrawShift] failed:", error.message);
    return { error: shiftErrorMessage(error.message) };
  }

  revalidatePath("/practice/shifts");
  revalidatePath("/admin/shifts");
  return { message: "Taken down. Anyone who offered has been told." };
}

/**
 * Give the shift to one of the locums who offered.
 *
 * Everything is re-checked inside award_shift — whether the shift is still
 * open, whether that locum is still free and still compliant — because a
 * claim describes how things were when it was made, and this page may have
 * been open a while.
 */
export async function awardShift(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = awardShiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  await requirePracticeOrAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("award_shift", {
    p_shift_id: parsed.data.shiftId,
    p_claim_id: parsed.data.claimId,
  });

  if (error) {
    console.error("[awardShift] failed:", error.message);
    return { error: shiftErrorMessage(error.message) };
  }

  revalidatePath("/practice/shifts");
  revalidatePath("/practice/bookings");
  revalidatePath("/admin/shifts");
  return { message: "Booked and confirmed. Both of you have been sent the details." };
}

/** A locum putting their hand up. The rate comes from their approved rates. */
export async function claimShift(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = claimShiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  await requireLocum({ requireApproved: true });
  const supabase = await createClient();

  const { error } = await supabase.rpc("claim_shift", {
    p_shift_id: parsed.data.shiftId,
    p_message: parsed.data.message || null,
  });

  if (error) {
    console.error("[claimShift] failed:", error.message);
    return { error: shiftErrorMessage(error.message) };
  }

  revalidatePath("/locum/shifts");
  return {
    message: "You're in. The practice has been told — they'll confirm or come back to you.",
  };
}

export async function withdrawClaim(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = shiftIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  await requireLocum();
  const supabase = await createClient();

  const { error } = await supabase.rpc("withdraw_claim", { p_shift_id: parsed.data.shiftId });
  if (error) {
    console.error("[withdrawClaim] failed:", error.message);
    return { error: shiftErrorMessage(error.message) };
  }

  revalidatePath("/locum/shifts");
  return { message: "Pulled out. The shift is back on your board if you change your mind." };
}

/**
 * The database messages here are written for a person to read — "that shift
 * is already filled", "set an approved rate first" — so they are passed
 * through rather than replaced with something vaguer.
 */
function shiftErrorMessage(message: string): string {
  if (/could not find the function|schema cache|does not exist/i.test(message)) {
    return "The database is missing an update — run migrations 0017 to 0019 in Supabase.";
  }
  if (
    /no longer open|already |no longer offering|can no longer|approved rate|Nothing to withdraw|not open/i.test(
      message,
    )
  ) {
    return message.replace(/^.*?:\s*/, "");
  }
  if (/not authorised|permission denied|row-level security/i.test(message)) {
    return "Your account doesn't have permission for that.";
  }
  return process.env.NODE_ENV === "development"
    ? `Failed: ${message}`
    : "That didn't go through. Try again.";
}
