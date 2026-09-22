"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn, type ActionState } from "@/features/auth/actions";
import { AuthCard } from "@/components/layout/auth-card";
import { Field, SubmitButton, Banner } from "@/components/ui/form";

export default function LoginPage() {
  const [state, action] = useActionState<ActionState, FormData>(signIn, {});
  const next = useSearchParams().get("next") ?? "";

  return (
    <AuthCard
      title="Sign in"
      lede="Practices, locums and Brighttemp staff all sign in here."
      footer={
        <>
          No account yet?{" "}
          <Link href="/register/practice" className="font-semibold text-[#0E3B36] underline">
            Register a practice
          </Link>{" "}
          or{" "}
          <Link href="/register/locum" className="font-semibold text-[#0E3B36] underline">
            join as a locum
          </Link>
          .
        </>
      }
    >
      <form action={action} noValidate>
        {state.error ? <Banner tone="error">{state.error}</Banner> : null}
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" autoComplete="email" required
               errors={state.fieldErrors?.email} />
        <Field label="Password" name="password" type="password"
               autoComplete="current-password" required
               errors={state.fieldErrors?.password} />
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/forgot-password" className="text-[#5E7370] underline">
          Forgotten your password?
        </Link>
      </p>
    </AuthCard>
  );
}
