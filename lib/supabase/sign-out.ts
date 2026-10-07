/**
 * Signing out must never depend on the network.
 *
 * `supabase.auth.signOut()` POSTs to Supabase to revoke the refresh token.
 * When that request fails — a dropped keep-alive socket, blocked egress, a
 * Supabase blip — the client returns the error and then *skips* clearing the
 * stored session, so the user stays signed in and the redirect to /login
 * bounces them straight back to their dashboard. In a redirecting Server
 * Action the same failure surfaces as a 500 ("failed to get redirect
 * response: TypeError: fetch failed").
 *
 * So we ask Supabase to revoke the token, ignore whatever comes back, and
 * clear the session cookies ourselves. The browser is signed out either way;
 * if the revoke never landed, that refresh token expires on its own.
 */

/** Supabase keeps the session in cookies named sb-<project-ref>-auth-token[.n]. */
export function isSupabaseAuthCookie(name: string) {
  return (
    name.startsWith("sb-") &&
    (name.includes("auth-token") || name.endsWith("code-verifier"))
  );
}

/**
 * Revoke the refresh token if Supabase is reachable. Never throws, and never
 * reports failure: the caller clears the cookies regardless.
 */
export async function revokeSessionQuietly(client: {
  auth: { signOut: () => Promise<unknown> };
}) {
  try {
    await client.auth.signOut();
  } catch {
    // Unreachable or misconfigured Supabase. Clearing the cookies below is
    // what actually signs the user out of this browser.
  }
}
