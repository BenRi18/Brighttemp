import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/features/auth/session";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/layout/auth-card";
import { LocumOnboardingForm } from "@/features/auth/components/locum-onboarding-form";

export const metadata = { title: "Your locum profile — Brighttemp" };

export default async function LocumOnboardingPage() {
  const account = await requireAccount();
  if (account.locum) redirect("/locum");

  const supabase = await createClient();
  const { data: roles } = await supabase
    .from("roles")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <AuthCard
      title="Set up your profile"
      lede="Your rate and availability come next. Nothing is visible to practices until Brighttemp approves you."
    >
      <LocumOnboardingForm roles={roles ?? []} />
    </AuthCard>
  );
}
