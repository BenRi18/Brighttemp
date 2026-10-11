"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseAuthCookie, revokeSessionQuietly } from "@/lib/supabase/sign-out";
import {
  loginSchema,
  locumSignUpSchema,
  practiceSignUpSchema,
  forgotPasswordSchema,
  updatePasswordSchema,
  practiceOnboardingSchema,
  locumOnboardingSchema,
} from "@/features/auth/schema";
import type { UserType } from "@/lib/database.types";
import { geocodePostcode } from "@/lib/geocode";
import { z } from "zod";

export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  message?: string;
  /** What was typed, so a rejected form can put it back. Never passwords. */
  values?: Record<string, string>;
  /** Set on a successful signup, so the success banner can offer a resend. */
  pendingEmail?: string;
};

const SECRET_FIELDS = new Set(["password", "confirmPassword"]);

/** Everything the user typed except the passwords, which are never echoed back. */
function keep(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v === "string" && !SECRET_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

function invalid(e: z.ZodError, formData?: FormData): ActionState {
  return {
    fieldErrors: e.flatten().fieldErrors as Record<string, string[]>,
    ...(formData ? { values: keep(formData) } : {}),
  };
}

// ---------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

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

/**
 * The shared half of both signups: create the auth user, carrying whatever
 * profile details the form collected into user metadata. The handle_new_user
 * trigger reads them from there when it writes the profile row.
 */
async function createAccount(
  userType: Exclude<UserType, "admin">,
  email: string,
  password: string,
  metadata: Record<string, string | null>,
  typed: Record<string, string>,
): Promise<ActionState> {
  // Refuses to build a link from an internal address, so a misconfigured host
  // can't email people a URL that won't open.
  let origin: string;
  try {
    origin = await siteUrl();
  } catch (e) {
    console.error("[signUp]", e instanceof Error ? e.message : e);
    return {
      error: "We can't send confirmation emails right now. Please contact support.",
      values: typed,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/onboarding/${userType}`,
      data: { user_type: userType, ...metadata },
    },
  });

  if (error) {
    // Full detail goes to the server log only — the terminal running `npm run dev`
    // locally, or your host's logs in production.
    console.error("[signUp] Supabase rejected the signup:", {
      code: error.code,
      status: error.status,
      message: error.message,
      ...(error.message?.toLowerCase().includes("sending")
        ? {
            check:
              "Supabase could not send the email. Dashboard → Logs → Auth Logs " +
              "carries the underlying SMTP error. Without custom SMTP the built-in " +
              "sender allows 2 emails an hour and only delivers to members of your " +
              "Supabase organisation.",
          }
        : {}),
    });
    return { error: signUpErrorMessage(error.code, error.message), values: typed };
  }

  return {
    pendingEmail: email,
    message:
      `Check ${email} for a confirmation link — including the spam folder, where it ` +
      "often lands. If that address already has an account, no new email is sent: " +
      "sign in instead, or reset the password.",
  };
}

/** Supabase auth error codes → something a practice manager can act on. */
function signUpErrorMessage(code: string | undefined, message: string): string {
  const m = message.toLowerCase();

  // Supabase returns a bare 500 "Error sending confirmation email" both when
  // SMTP is misconfigured and when the built-in sender's cap (2 an hour) is
  // used up. The account is not created either way, so saying "try again"
  // is the truthful advice — and the server log says where to look.
  if (m.includes("sending confirmation email") || m.includes("error sending")) {
    return (
      "We couldn't send your confirmation email, so the account wasn't created. " +
      "Please try again in a few minutes."
    );
  }
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with that email. Try signing in.";
    case "weak_password":
      return "That password doesn't meet the security rules. Try a longer one with a mix of letters and numbers.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many sign-up attempts in a short time. Wait a few minutes and try again.";
    case "email_address_invalid":
      return "That email address can't be used. Check it, or try a different one.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "New registrations are switched off at the moment.";
    case "unexpected_failure":
      // Almost always the handle_new_user database trigger failing.
      return "We couldn't set up your profile. Please try again, or contact us if it keeps happening.";
  }
  if (m.includes("already registered")) {
    return "There's already an account with that email. Try signing in.";
  }
  if (process.env.NODE_ENV === "development") {
    return `Sign-up failed: ${message}${code ? ` (${code})` : ""}`;
  }
  return "We couldn't create the account. Try again in a moment.";
}

export async function signUpPractice(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = practiceSignUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;

  return createAccount("practice", d.email, d.password, {
    // A practice registers as a business, so the practice name is the name on
    // the account — it is what the portal header and the admin lists show.
    first_name: d.practiceName,
    last_name: "",
    phone: d.phone || null,
    // Carried through to pre-fill the onboarding form rather than asked twice.
    practice_name: d.practiceName,
    address_line1: d.addressLine1,
    address_line2: d.addressLine2 || null,
    city: d.city,
    postcode: d.postcode,
    // Kept for projects where migration 0010 has not been applied yet: the old
    // trigger reads full_name and knows nothing about the two parts.
    full_name: d.practiceName,
  }, keep(formData));
}

export async function signUpLocum(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = locumSignUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);
  const d = parsed.data;

  return createAccount("locum", d.email, d.password, {
    first_name: d.firstName,
    last_name: d.lastName,
    phone: d.phone || null,
    // Same reason: harmless once 0010 is applied, essential before it.
    full_name: `${d.firstName} ${d.lastName}`,
  }, keep(formData));
}

/**
 * Send the confirmation again. Supabase only does this for an address that
 * exists and is still unconfirmed; for anything else it quietly does nothing,
 * so this cannot be used to find out who has an account.
 */
export async function resendConfirmation(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "No address to send to." };

  let origin: string;
  try {
    origin = await siteUrl();
  } catch (e) {
    console.error("[resendConfirmation]", e instanceof Error ? e.message : e);
    return { error: "We can't send emails right now. Please contact support." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    console.error("[resendConfirmation]", { code: error.code, message: error.message });
    if (error.code === "over_email_send_rate_limit") {
      return {
        pendingEmail: email,
        error:
          "That's as many emails as we can send to you for the moment. Wait a few " +
          "minutes, and check your spam folder in the meantime.",
      };
    }
    return { pendingEmail: email, error: "We couldn't send it again just now. Try shortly." };
  }

  return { pendingEmail: email, message: `Sent again to ${email}. It can take a minute to arrive.` };
}

// ---------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------

export async function requestPasswordReset(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalid(parsed.error, formData);

  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${await siteUrl()}/auth/callback?next=/update-password`,
    });
  } catch (e) {
    // Logged, but never shown: the reply below must not differ by outcome, or
    // it tells an attacker which addresses are registered.
    console.error("[requestPasswordReset]", e instanceof Error ? e.message : e);
  }

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
  if (!parsed.success) return invalid(parsed.error, formData);

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
  const cookieStore = await cookies();

  // Collected before the sign-out, which removes them when it succeeds.
  const sessionCookies = cookieStore
    .getAll()
    .filter((c) => isSupabaseAuthCookie(c.name))
    .map((c) => c.name);

  const supabase = await createClient();
  await revokeSessionQuietly(supabase);

  // Clear them ourselves, so an unreachable Supabase can't leave the user
  // signed in — or turn a sign-out into a 500.
  for (const name of sessionCookies) cookieStore.delete(name);

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
  if (!parsed.success) return invalid(parsed.error, formData);

  const supabase = await createClient();
  const d = parsed.data;

  // Without coordinates the practice cannot search — search_locums filters on
  // lat/lng. Fail here rather than saving a practice that silently finds nobody.
  const coords = await geocodePostcode(d.postcode);
  if (!coords) {
    return { fieldErrors: { postcode: ["We couldn't find that postcode. Check and try again."] } };
  }

  // RLS only permits status 'pending' here — a practice cannot approve itself.
  // The claim_new_practice trigger makes the creator the owner.
  const { error } = await supabase.from("practices").insert({
    name: d.name,
    trading_name: d.tradingName || null,
    address_line1: d.addressLine1,
    address_line2: d.addressLine2 || null,
    city: d.city,
    postcode: d.postcode,
    latitude: coords.latitude,
    longitude: coords.longitude,
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
  if (!parsed.success) return invalid(parsed.error, formData);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const d = parsed.data;

  const coords = await geocodePostcode(d.basePostcode);
  if (!coords) {
    return { fieldErrors: { basePostcode: ["We couldn't find that postcode. Check and try again."] } };
  }

  const { error } = await supabase.from("locums").insert({
    profile_id: user.id,
    role_id: d.roleId,
    gdc_number: d.gdcNumber || null,
    years_experience: d.yearsExperience,
    base_postcode: d.basePostcode,
    latitude: coords.latitude,
    longitude: coords.longitude,
    travel_radius_miles: d.travelRadiusMiles,
    bio: d.bio || null,
  });

  if (error) return { error: "We couldn't save your profile. Try again." };

  revalidatePath("/", "layout");
  // Compliance documents next — they are what unlocks appearing in search.
  redirect("/locum/compliance");
}
