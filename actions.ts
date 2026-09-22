"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  signUpSchema,
  forgotPasswordSchema,
  updatePasswordSchema,
  practiceOnboardingSchema,
  locumOnboardingSchema,
} from "@/lib/auth/validation";
import type { UserType } from "@/lib/database.types";
import { z } from "zod";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
};

function invalid(e: z.ZodError): ActionState {
  return { fieldErrors: e.flatten().fieldErrors as Record<string, string[]> };
}

async function siteUrl() {
  const h = await headers();
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`
  );
}

// ---------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately vague: a precise message tells an attacker which
    // addresses are registered.
    return { error: "That email and password combination isn't right." };
  }

  const userType = (data.user.app_metadata?.user_type ?? "practice") as UserType;
  const fallback = { practice: "/practice", locum: "/locum", admin: "/admin" }[userType];

  revalidatePath("/", "layout");
  redirect(parsed.data.next?.startsWith("/") ? parsed.data.next : fallback);
}

// ---------------------------------------------------------------------
// Registration — the trigger creates the profile; onboarding creates the
// practice or locum record once they land with a session.
// ---------------------------------------------------------------------

async function signUp(
  formData: FormData,
  userType: Exclude<UserType, "admin">,
): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=/onboarding/${userType}`,
      data: {
        user_type: userType,
        full_name: parsed.data.fullName,
        phone: parsed.data.phone || null,
      },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "There's already an account with that email. Try signing in." };
    }
    return { error: "We couldn't create the account. Try again in a moment." };
  }

  return {
    message:
      "Check your email and open the confirmation link to finish setting up your account.",
  };
}

export const signUpPractice = (_: ActionState, formData: FormData) =>
  signUp(formData, "practice");

export const signUpLocum = (_: ActionState, formData: FormData) =>
  signUp(formData, "locum");

// ---------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------

export async function requestPasswordReset(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/update-password`,
  });

  // Always the same answer, whether or not the address exists.
  return {
    message: "If that email has an account, a reset link is on its way.",
  };
}

export async function updatePassword(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "That reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "We couldn't update the password. Try again." };

  const userType = (user.app_metadata?.user_type ?? "practice") as UserType;
  redirect({ practice: "/practice", locum: "/locum", admin: "/admin" }[userType]);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ---------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------

export async function completePracticeOnboarding(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = practiceOnboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const d = parsed.data;

  // RLS only permits status 'pending' here — a practice cannot approve itself.
  // The claim_new_practice trigger makes the creator the owner.
  const { error } = await supabase.from("practices").insert({
    name: d.name,
    trading_name: d.tradingName || null,
    address_line1: d.addressLine1,
    address_line2: d.addressLine2 || null,
    city: d.city,
    postcode: d.postcode,
    phone: d.phone || null,
    billing_email: d.billingEmail || null,
    vat_number: d.vatNumber || null,
  });

  if (error) return { error: "We couldn't save the practice details. Try again." };

  revalidatePath("/", "layout");
  redirect("/pending");
}

export async function completeLocumOnboarding(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = locumOnboardingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const d = parsed.data;
  const { error } = await supabase.from("locums").insert({
    profile_id: user.id,
    role_id: d.roleId,
    gdc_number: d.gdcNumber || null,
    years_experience: d.yearsExperience,
    base_postcode: d.basePostcode,
    travel_radius_miles: d.travelRadiusMiles,
    bio: d.bio || null,
  });

  if (error) return { error: "We couldn't save your profile. Try again." };

  revalidatePath("/", "layout");
  // Compliance documents next — they are what unlocks appearing in search.
  redirect("/locum/compliance");
}