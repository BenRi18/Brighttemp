import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Why didn't the confirmation email arrive?
 *
 * Four things look identical from an empty inbox, and they have four different
 * fixes. This asks Supabase directly and says which one it is:
 *
 *   1. The account was never created        — signup itself failed
 *   2. Created, confirmation never sent     — confirmations are switched off
 *   3. Created, sent, still unconfirmed     — sent fine; it's a delivery problem
 *   4. Already confirmed                    — Supabase sends nothing on a repeat
 *                                             signup, on purpose, so that the
 *                                             form can't be used to discover
 *                                             who already has an account
 *
 *   /api/debug/signup?key=YOUR_CRON_SECRET&email=someone@example.com
 *
 * Add &link=1 to mint a sign-in link without sending an email — it both signs
 * you in and confirms the address, so you are not blocked while sending is.
 *
 * Remove this route before you have real practices on the system: with the
 * secret it reveals whether a given address has an account.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const params = request.nextUrl.searchParams;
  if (!secret || params.get("key") !== secret) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const email = params.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Add &email=the address you signed up with" }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (e) {
    return NextResponse.json({
      verdict: "Can't check — SUPABASE_SERVICE_ROLE_KEY is missing or wrong.",
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // listUsers pages; 200 at a time is plenty for a site this young.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) {
    return NextResponse.json({ verdict: "Couldn't reach Supabase.", error: error.message });
  }

  const user = data.users.find((u) => u.email?.toLowerCase() === email);

  // Has migration 0010 been applied? A signup works either way, but it is worth
  // knowing which trigger is live.
  let migration0010: string;
  const probe = await admin.from("profiles").select("first_name").limit(1);
  migration0010 = probe.error
    ? probe.error.message.includes("first_name")
      ? "NOT applied — profiles.first_name does not exist yet"
      : `unknown (${probe.error.message})`
    : "applied";

  if (!user) {
    return NextResponse.json({
      email,
      found: false,
      verdict:
        "No account with that address. The signup itself failed, so no email was ever sent. " +
        "Check your hosting logs for a line starting [signUp].",
      totalUsers: data.users.length,
      migration0010,
    });
  }

  const sent = user.confirmation_sent_at;
  const confirmed = user.email_confirmed_at;
  const ageMins = (t: string | undefined) =>
    t ? Math.round((Date.now() - new Date(t).getTime()) / 60000) : null;

  let verdict: string;
  let fix: string | null = null;

  if (confirmed) {
    verdict =
      "This address is already confirmed. Signing up with it again sends nothing — " +
      "Supabase does that deliberately, so the form can't be used to find out who " +
      "already has an account. That is almost certainly what you hit.";
    fix =
      "Test with an address you have never used, or delete this user under " +
      "Authentication → Users and sign up again.";
  } else if (!sent) {
    verdict =
      "The account exists but Supabase never sent a confirmation. Email confirmation " +
      "is switched off for this project.";
    fix =
      "Authentication → Sign In / Providers → Email → turn on 'Confirm email'.";
  } else {
    verdict =
      `Supabase sent the confirmation ${ageMins(sent)} minutes ago and it has not been ` +
      "opened. So sending worked and delivery is the problem — it is in a spam folder, " +
      "or the built-in sender dropped it.";
    fix =
      "Check spam first. Then set up custom SMTP (docs/email-setup.md): the built-in " +
      "sender is for testing, is capped at a couple of emails an hour, and is widely " +
      "filtered. Authentication → Rate Limits shows whether you are over the cap.";
  }

  // A way in while sending is broken. A magic link is used rather than a signup
  // link because the account already exists — a signup link would be refused —
  // and opening it both signs them in and confirms the address.
  let signInLink: string | undefined;
  if (params.get("link") === "1") {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${process.env.SITE_URL ?? ""}/auth/callback` },
    });
    signInLink = linkError
      ? `could not generate: ${linkError.message}`
      : linkData.properties?.action_link;
  }

  return NextResponse.json({
    email,
    found: true,
    verdict,
    fix,
    signInLink,
    detail: {
      createdAt: user.created_at,
      createdMinutesAgo: ageMins(user.created_at),
      confirmationSentAt: sent ?? null,
      confirmationSentMinutesAgo: ageMins(sent),
      emailConfirmedAt: confirmed ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      userType: user.app_metadata?.user_type ?? null,
      metadataKeys: Object.keys(user.user_metadata ?? {}),
    },
    migration0010,
  });
}
