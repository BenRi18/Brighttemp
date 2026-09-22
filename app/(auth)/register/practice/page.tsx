import Link from "next/link";
import { signUpPractice } from "@/features/auth/actions";
import { AuthCard } from "@/components/layout/auth-card";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata = { title: "Register your practice — Brighttemp" };

export default function RegisterPracticePage() {
  return (
    <AuthCard
      title="Register your practice"
      lede="Free to register. We'll review your details before you can book."
      footer={
        <>
          Looking for locum work instead?{" "}
          <Link href="/register/locum" className="font-semibold text-[#0E3B36] underline">
            Join as a locum
          </Link>
          .
        </>
      }
    >
      <RegisterForm action={signUpPractice} cta="Create practice account" />
    </AuthCard>
  );
}
