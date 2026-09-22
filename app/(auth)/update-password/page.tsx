"use client";

import { useActionState } from "react";
import { updatePassword, type ActionState } from "@/features/auth/actions";
import { AuthCard } from "@/components/layout/auth-card";
import { Field, SubmitButton, Banner } from "@/components/ui/form";

export default function UpdatePasswordPage() {
  const [state, action] = useActionState<ActionState, FormData>(updatePassword, {});

  return (
    <AuthCard title="Choose a new password" lede="You're signed in from the reset link.">
      <form action={action} noValidate>
        {state.error ? <Banner tone="error">{state.error}</Banner> : null}
        <Field label="New password" name="password" type="password"
               autoComplete="new-password" required hint="At least 12 characters."
               errors={state.fieldErrors?.password} />
        <Field label="Confirm password" name="confirmPassword" type="password"
               autoComplete="new-password" required
               errors={state.fieldErrors?.confirmPassword} />
        <SubmitButton>Save password</SubmitButton>
      </form>
    </AuthCard>
  );
}
