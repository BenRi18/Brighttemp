import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Practice, Locum, Tables } from "@/lib/database.types";

export type PracticeMembership = {
  practice: Practice;
  role: Tables<"practice_users">["role"];
};

export type Account = {
  profile: Profile;
  practice: PracticeMembership | null;
  locum: Locum | null;
  admin: Tables<"admin_users"> | null;
};

/**
 * Deduplicated per request — call it freely from layouts, pages and
 * actions without stacking up queries.
 */
export const getAccount = cache(async (): Promise<Account | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  if (profile.user_type === "practice") {
    const { data } = await supabase
      .from("practice_users")
      .select("role, practices(*)")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle();

    const practice = (data?.practices as Practice | null) ?? null;
    return {
      profile,
      practice: practice ? { practice, role: data!.role } : null,
      locum: null,
      admin: null,
    };
  }

  if (profile.user_type === "locum") {
    const { data: locum } = await supabase
      .from("locums")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();
    return { profile, practice: null, locum: locum ?? null, admin: null };
  }

  const { data: admin } = await supabase
    .from("admin_users")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();
  return { profile, practice: null, locum: null, admin: admin ?? null };
});

export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/login");
  return account;
}

/**
 * Gate for /practice/*. Sends an unfinished registration to onboarding and
 * an unapproved practice to the holding page, so pages below can assume
 * an approved practice exists.
 */
export async function requirePractice() {
  const account = await requireAccount();
  if (account.profile.user_type !== "practice") redirect("/");
  if (!account.practice) redirect("/onboarding/practice");
  if (account.practice.practice.status !== "approved") redirect("/pending");
  return { ...account, practice: account.practice };
}

/**
 * For actions a practice manager and an admin both take on the same row —
 * awarding a shift, taking one down.
 *
 * Deliberately loose, because it is not the real check: the database
 * functions behind these actions authorise properly, down to which practice
 * the row belongs to. This only keeps a signed-out visitor or a locum from
 * reaching the action at all, and spares us two near-identical copies of
 * every shift action and of the component that calls them.
 */
export async function requirePracticeOrAdmin() {
  const account = await requireAccount();
  const isPractice = account.profile.user_type === "practice" && account.practice !== null;
  const isAdmin = account.admin !== null && account.admin.is_active;
  if (!isPractice && !isAdmin) redirect("/");
  return account;
}

/** Gate for /locum/*. An unapproved locum can still build their profile. */
export async function requireLocum(options: { requireApproved?: boolean } = {}) {
  const account = await requireAccount();
  if (account.profile.user_type !== "locum") redirect("/");
  if (!account.locum) redirect("/onboarding/locum");
  if (options.requireApproved && account.locum.status !== "approved") redirect("/pending");
  return { ...account, locum: account.locum };
}

/** Gate for /admin/*. */
export async function requireAdmin(
  roles?: Tables<"admin_users">["admin_role"][],
) {
  const account = await requireAccount();
  if (!account.admin || !account.admin.is_active) redirect("/");
  if (roles && !roles.includes(account.admin.admin_role)) redirect("/admin");
  return { ...account, admin: account.admin };
}
