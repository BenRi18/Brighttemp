import { createClient } from "@/lib/supabase/server";
import { AuthCard } from "@/components/layout/auth-card";
import {
  PracticeOnboardingForm,
  type PracticeDefaults,
} from "@/features/auth/components/practice-onboarding-form";

/** The address given at registration, stashed in user metadata by signUpPractice. */
function defaultsFrom(meta: Record<string, unknown> | undefined): PracticeDefaults {
  const str = (key: string) => {
    const v = meta?.[key];
    return typeof v === "string" && v.trim() ? v : undefined;
  };
  return {
    name: str("practice_name"),
    addressLine1: str("address_line1"),
    addressLine2: str("address_line2"),
    city: str("city"),
    postcode: str("postcode"),
  };
}

export default async function PracticeOnboardingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const defaults = defaultsFrom(data.user?.user_metadata);
  const prefilled = Boolean(defaults.name || defaults.postcode);

  return (
    <AuthCard
      title="Tell us about the practice"
      lede={
        prefilled
          ? "We've filled in what you gave us. Check it over and add the rest."
          : "We use the postcode to work out which locums are in range."
      }
    >
      <PracticeOnboardingForm defaults={defaults} />
    </AuthCard>
  );
}
