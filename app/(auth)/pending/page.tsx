import { requireAccount } from "@/features/auth/session";
import { AuthCard } from "@/components/layout/auth-card";

export const metadata = { title: "Awaiting approval — Brighttemp" };

export default async function PendingPage() {
  const account = await requireAccount();
  const isLocum = account.profile.user_type === "locum";

  return (
    <AuthCard
      title="We're reviewing your account"
      lede={
        isLocum
          ? "Once your six compliance documents are approved you'll start appearing in practice searches."
          : "A member of the Brighttemp team is checking your practice details. We'll email you as soon as you can start booking."
      }
    >
      <p className="text-[#5E7370]">
        {isLocum
          ? "You can keep building your profile in the meantime — set your rate, mark your availability and upload anything still outstanding."
          : "Most practices are approved within one working day."}
      </p>
      <form action="/auth/sign-out" method="post" className="mt-8">
        <button type="submit" className="text-sm text-[#5E7370] underline">
          Sign out
        </button>
      </form>
    </AuthCard>
  );
}
