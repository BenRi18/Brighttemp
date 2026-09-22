"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type ActionState } from "@/features/auth/actions";
import { AuthCard } from "@/components/layout/auth-card";
import { Field, SubmitButton, Banner } from "@/components/ui/form";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<ActionState, FormData>(requestPasswordReset, {});

  return (
    <AuthCard
      title="Reset your password"
      lede="We'll email you a link to set a new one."
      footer={
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      }
    >
      {state.message ? (
        <Banner tone="success">{state.message}</Banner>
      ) : (
        <form action={action} noValidate>
          {state.error ? <Banner tone="error">{state.error}</Banner> : null}
          <Field label="Email" name="email" type="email" autoComplete="email" required
                 errors={state.fieldErrors?.email} />
          <SubmitButton>Send reset link</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
