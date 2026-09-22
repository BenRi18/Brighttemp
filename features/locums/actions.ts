"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/features/auth/session";
import { geocodePostcode } from "@/lib/geocode";
import {
  availabilitySchema,
  bulkAvailabilitySchema,
  rateRequestSchema,
  locumProfileSchema,
} from "./schema";
import type { ActionState } from "@/features/auth/actions";
import type { UpdateDto } from "@/lib/database.types";

/** Set or clear a single day. Upsert, because the table is one row per date. */
export async function setAvailability(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = availabilitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const account = await requireAccount();
  if (!account.locum) return { error: "Not a locum account." };

  const d = parsed.data;
  if (d.isAvailable && (!d.startTime || !d.finishTime)) {
    return { error: "Give the hours you're available for that day." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("locum_availability").upsert(
    {
      locum_id: account.locum.id,
      available_on: d.date,
      is_available: d.isAvailable,
      start_time: d.isAvailable ? d.startTime : null,
      finish_time: d.isAvailable ? d.finishTime : null,
      note: d.note || null,
    },
    { onConflict: "locum_id,available_on" },
  );

  if (error) return { error: "We couldn't save that day." };
  revalidatePath("/locum/availability");
  return { message: d.isAvailable ? "Marked available." : "Marked unavailable." };
}

/** Fill a date range in one go — the common case when planning a month. */
export async function setAvailabilityRange(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = bulkAvailabilitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const account = await requireAccount();
  if (!account.locum) return { error: "Not a locum account." };

  const d = parsed.data;
  if (d.finishTime <= d.startTime) {
    return { fieldErrors: { finishTime: ["The finish time must be after the start time"] } };
  }

  const rows: {
    locum_id: string;
    available_on: string;
    is_available: boolean;
    start_time: string;
    finish_time: string;
  }[] = [];

  const cursor = new Date(`${d.fromDate}T00:00:00Z`);
  const end = new Date(`${d.toDate}T00:00:00Z`);
  while (cursor <= end && rows.length < 366) {
    const dow = cursor.getUTCDay();
    const skip = d.weekdaysOnly === "on" && (dow === 0 || dow === 6);
    if (!skip) {
      rows.push({
        locum_id: account.locum.id,
        available_on: cursor.toISOString().slice(0, 10),
        is_available: true,
        start_time: d.startTime,
        finish_time: d.finishTime,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("locum_availability")
    .upsert(rows, { onConflict: "locum_id,available_on" });

  if (error) return { error: "We couldn't save those dates." };
  revalidatePath("/locum/availability");
  return { message: `${rows.length} days marked available.` };
}

/**
 * Rate changes are requests, not edits. RLS only lets a locum insert rows with
 * status 'pending'; existing approved rates stay live until an admin approves
 * the replacement, so a booking in flight never sees a half-applied rate.
 */
export async function requestRateChange(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = rateRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const account = await requireAccount();
  if (!account.locum) return { error: "Not a locum account." };

  const supabase = await createClient();
  const { error } = await supabase.from("locum_rates").insert([
    { locum_id: account.locum.id, day_type: "weekday", hourly_rate: parsed.data.weekday },
    { locum_id: account.locum.id, day_type: "weekend", hourly_rate: parsed.data.weekend },
    { locum_id: account.locum.id, day_type: "bank_holiday", hourly_rate: parsed.data.bankHoliday },
  ]);

  if (error) return { error: "We couldn't submit that rate change." };
  revalidatePath("/locum/rates");
  return { message: "Rate change submitted. Your current rate stays live until it's approved." };
}

export async function updateLocumProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = locumProfileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const account = await requireAccount();
  if (!account.locum) return { error: "Not a locum account." };

  const d = parsed.data;
  const supabase = await createClient();

  const patch: UpdateDto<"locums"> = {
    bio: d.bio || null,
    years_experience: d.yearsExperience,
    travel_radius_miles: d.travelRadiusMiles,
  };

  // Only re-geocode when the postcode actually changed.
  if (d.basePostcode !== account.locum.base_postcode) {
    const coords = await geocodePostcode(d.basePostcode);
    if (!coords) {
      return { fieldErrors: { basePostcode: ["We couldn't find that postcode."] } };
    }
    patch.base_postcode = d.basePostcode;
    patch.latitude = coords.latitude;
    patch.longitude = coords.longitude;
  }

  const { error } = await supabase.from("locums").update(patch).eq("id", account.locum.id);
  if (error) return { error: "We couldn't save your profile." };

  revalidatePath("/locum/settings");
  return { message: "Profile updated." };
}
