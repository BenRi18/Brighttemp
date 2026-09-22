"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/features/auth/session";
import { enqueue } from "@/features/notifications/enqueue";
import {
  requestBookingSchema,
  cancelBookingSchema,
  bookingIdSchema,
} from "./schema";
import type { ActionState } from "@/features/auth/actions";
import { z } from "zod";

const invalid = (e: z.ZodError): ActionState => ({
  fieldErrors: e.flatten().fieldErrors as Record<string, string[]>,
});

/**
 * Raise a booking request. Note what is NOT sent: the booking fee, the day
 * type and the same-day flag. The price_booking trigger derives those from
 * the fee table, so a tampered form cannot buy a cheaper booking.
 */
export async function requestBooking(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = requestBookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const account = await requireAccount();
  if (!account.practice) return { error: "Only a practice can raise a booking." };

  const supabase = await createClient();
  const d = parsed.data;

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      practice_id: account.practice.practice.id,
      locum_id: d.locumId,
      role_id: d.roleId,
      booking_date: d.date,
      start_time: d.startTime,
      finish_time: d.finishTime,
      locum_hourly_rate: d.hourlyRate,
      fee_day_type: "weekday", // overwritten by the pricing trigger
      booking_fee: 0, // ditto
      notes: d.notes || null,
      created_by: account.profile.id,
    })
    .select("id, reference, booking_date, locums ( profiles!locums_profile_id_fkey ( id, email ) )")
    .single();

  if (error) {
    // The exclusion constraint fires when someone else booked that slot first.
    if (error.code === "23P01") {
      return { error: "That locum was just booked for those hours. Try another." };
    }
    return { error: "We couldn't raise that booking. Try again." };
  }

  const locumProfile = booking.locums?.profiles;
  if (locumProfile) {
    await enqueue(supabase, [
      {
        profileId: locumProfile.id,
        recipient: locumProfile.email,
        event: "booking_requested",
        subject: `New shift request for ${booking.booking_date}`,
        bookingId: booking.id,
        payload: { reference: booking.reference },
      },
    ]);
  }

  revalidatePath("/practice/bookings");
  redirect(`/practice/bookings/${booking.id}`);
}

/** Locum accepts. The transition trigger enforces who may do this. */
export async function acceptBooking(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = bookingIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "accepted" })
    .eq("id", parsed.data.bookingId)
    .select("id, reference, requires_admin_approval, practices ( name )")
    .single();

  if (error) return { error: humanise(error.message) };

  revalidatePath("/locum");
  return {
    message: data.requires_admin_approval
      ? "Accepted. Brighttemp will confirm it shortly."
      : "Accepted. The practice has been notified.",
  };
}

export async function declineBooking(_: ActionState, formData: FormData): Promise<ActionState> {
  return cancelBooking(_, formData);
}

/**
 * Cancellation goes through the cancel_booking function, not a plain update,
 * because notice hours and the cancellation fee have to be computed at the
 * same instant the status changes.
 */
export async function cancelBooking(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = cancelBookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const account = await requireAccount();
  const supabase = await createClient();

  const actorType =
    account.profile.user_type === "practice"
      ? ("practice" as const)
      : account.profile.user_type === "locum"
        ? ("locum" as const)
        : ("admin" as const);

  const { error } = await supabase.rpc("cancel_booking", {
    p_booking_id: parsed.data.bookingId,
    p_actor: account.profile.id,
    p_actor_type: actorType,
    p_reason: parsed.data.reason,
  });

  if (error) return { error: humanise(error.message) };

  revalidatePath("/practice/bookings");
  revalidatePath("/locum");
  return { message: "Booking cancelled. Both sides have been notified." };
}

/** Marks a worked shift complete. Practice-side confirmation of attendance. */
export async function completeBooking(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = bookingIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status: "completed" })
    .eq("id", parsed.data.bookingId);

  if (error) return { error: humanise(error.message) };
  revalidatePath("/practice/bookings");
  return { message: "Shift marked as complete." };
}

/** Database exceptions are precise but not written for practice managers. */
function humanise(message: string) {
  if (message.includes("can no longer be changed")) {
    return "That booking is already closed.";
  }
  if (message.includes("cannot be amended")) {
    return "Confirmed bookings can't be changed — cancel and rebook instead.";
  }
  if (message.includes("Not a party")) {
    return "You don't have access to that booking.";
  }
  return "We couldn't update that booking. Try again.";
}
