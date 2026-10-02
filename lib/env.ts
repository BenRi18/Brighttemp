/**
 * Environment variables, read in one place with errors that say what to fix.
 *
 * NEXT_PUBLIC_* values are baked into the build, so they must be set BEFORE
 * the build that uses them. Setting them afterwards and only restarting the
 * process leaves them undefined — rebuild, don't just restart.
 */

function required(name: string, value: string | undefined): string {
  if (!value || !value.trim()) {
    throw new Error(
      `Missing environment variable ${name}. ` +
        (name.startsWith("NEXT_PUBLIC_")
          ? "Set it in your host's environment variables and rebuild — this one is baked in at build time."
          : "Set it in your host's environment variables."),
    );
  }
  return value;
}

export function supabaseUrl() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL must start with https:// — got "${url}". ` +
        "Copy the Project URL from Supabase → Project Settings → Data API.",
    );
  }
  return url;
}

export const supabaseAnonKey = () =>
  required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabaseServiceRoleKey = () =>
  required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);

/** True when both public Supabase values are present and usable. */
export function supabaseConfigured() {
  try {
    supabaseUrl();
    supabaseAnonKey();
    return true;
  } catch {
    return false;
  }
}
