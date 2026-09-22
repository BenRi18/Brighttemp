"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/features/auth/session";
import { geocodePostcode } from "@/lib/geocode";
import { practiceSettingsSchema, favouriteSchema } from "./schema";
import type { ActionState } from "@/features/auth/actions";
import type { UpdateDto } from "@/lib/database.types";

export async function updatePractice(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = practiceSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const account = await requireAccount();
  if (!account.practice) return { error: "Not a practice account." };

  const d = parsed.data;
  const patch: UpdateDto<"practices"> = {
    name: d.name,
    trading_name: d.tradingName || null,
    address_line1: d.addressLine1,
    address_line2: d.addressLine2 || null,
    city: d.city,
    phone: d.phone || null,
    billing_email: d.billingEmail || null,
    vat_number: d.vatNumber || null,
  };

  if (d.postcode !== account.practice.practice.postcode) {
    const coords = await geocodePostcode(d.postcode);
    if (!coords) return { fieldErrors: { postcode: ["We couldn't find that postcode."] } };
    patch.postcode = d.postcode;
    patch.latitude = coords.latitude;
    patch.longitude = coords.longitude;
  }

  // status and trust_level are absent on purpose — the column grants would
  // reject them anyway, but not sending them keeps the intent obvious.
  const supabase = await createClient();
  const { error } = await supabase
    .from("practices")
    .update(patch)
    .eq("id", account.practice.practice.id);

  if (error) return { error: "We couldn't save those details." };
  revalidatePath("/practice/settings");
  return { message: "Practice details updated." };
}

export async function toggleFavourite(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = favouriteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };

  const account = await requireAccount();
  if (!account.practice) return { error: "Not a practice account." };

  const supabase = await createClient();
  const practiceId = account.practice.practice.id;

  const { error } =
    parsed.data.action === "add"
      ? await supabase.from("favourite_locums").insert({
          practice_id: practiceId,
          locum_id: parsed.data.locumId,
          created_by: account.profile.id,
        })
      : await supabase
          .from("favourite_locums")
          .delete()
          .eq("practice_id", practiceId)
          .eq("locum_id", parsed.data.locumId);

  if (error) return { error: "We couldn't update your favourites." };
  revalidatePath("/practice/favourites");
  return {};
}
