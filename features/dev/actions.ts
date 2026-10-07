"use server";

import { redirect, notFound } from "next/navigation";
import { cookies } from "next/headers";
import { mockModeEnabled, MOCK_ROLE_COOKIE } from "@/lib/supabase/mock";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ACCOUNTS, demoEmail, demoPreviewEnabled } from "./demo";
import { revokeSessionQuietly } from "@/lib/supabase/sign-out";

/**
 * Signs in as one of the demo accounts and opens the requested page. Uses the
 * normal password sign-in, so every gate, redirect and RLS policy behaves
 * exactly as it does for a real user.
 */
export async function signInAsDemo(formData: FormData) {
  if (!demoPreviewEnabled()) notFound();

  const key = String(formData.get("account") ?? "");
  const next = String(formData.get("next") ?? "/");
  const account = DEMO_ACCOUNTS.find((a) => a.key === key);
  if (!account) redirect("/dev?error=unknown_account");
  const target = next.startsWith("/") ? next : "/";

  // Preview mode: no real sign-in — just remember which role to show.
  if (mockModeEnabled()) {
    (await cookies()).set(MOCK_ROLE_COOKIE, account.key, { path: "/", sameSite: "lax" });
    revalidatePath("/", "layout");
    redirect(target);
  }

  const supabase = await createClient();
  await revokeSessionQuietly(supabase);

  const { error } = await supabase.auth.signInWithPassword({
    email: demoEmail(account.local),
    password: process.env.DEMO_PASSWORD ?? "Brighttemp-demo-2026",
  });

  if (error) {
    redirect(`/dev?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(target);
}

export async function signOutDemo() {
  if (!demoPreviewEnabled()) notFound();
  if (mockModeEnabled()) {
    (await cookies()).set(MOCK_ROLE_COOKIE, "visitor", { path: "/", sameSite: "lax" });
    revalidatePath("/", "layout");
    redirect("/dev");
  }
  const supabase = await createClient();
  await revokeSessionQuietly(supabase);
  revalidatePath("/", "layout");
  redirect("/dev");
}
