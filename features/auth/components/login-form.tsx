"use client";

import { useActionState } from "react";
import { signIn, type ActionState } from "@/features/auth/actions";
import { Field, SubmitButton, Banner } from "@/components/ui/form";

const LINK_ERRORS: Record<string, string> = {
  expired_link: "That link has expired or was already used. Sign in, or request a new one.",
  missing_code: "That link was incomplete. Try opening it again from the email.",
  bad_link: "That link was incomplete. Try opening it again from the email.",
};

export function LoginForm({ next, linkError }: { next: string; linkError?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(signIn, {});
  const error = state.error ?? (linkError ? LINK_ERRORS[linkError] ?? linkError : undefined);

  return (
    <form action={action} noValidate>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" required
             errors={state.fieldErrors?.email} />
      <Field label="Password" name="password" type="password"
             autoComplete="current-password" required
             errors={state.fieldErrors?.password} />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}
