import Link from "next/link";
import { signUpLocum } from "@/features/auth/actions";
import { AuthCard } from "@/components/layout/auth-card";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata = { title: "Join as a locum — Brighttemp" };

export default function RegisterLocumPage() {
  return (
    <AuthCard
      title="Join as a locum"
      lede="Free, now and later. You set your own rate and we never take a cut of it."
      footer={
        <>
          Registering a practice?{" "}
          <Link href="/register/practice" className="font-semibold text-[#0E3B36] underline">
            Start here
          </Link>
          .
        </>
      }
    >
      <RegisterForm action={signUpLocum} cta="Create locum account" />
    </AuthCard>
  );
}
