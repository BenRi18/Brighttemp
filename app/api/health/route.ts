import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Deployment check: is the app configured, and can this server actually reach
 * Supabase? Answers the "fetch failed" case, which looks identical whether the
 * URL is wrong, DNS is broken, or outbound traffic is blocked.
 *
 * Protected by CRON_SECRET so it can't be used to probe your setup:
 *   /api/health?key=YOUR_CRON_SECRET
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const key = request.nextUrl.searchParams.get("key");
  if (!secret || key !== secret) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Show enough to spot a typo, never enough to use.
  const show = (v: string | undefined) =>
    !v ? "MISSING" : `set (${v.length} chars, starts "${v.slice(0, 6)}…")`;

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: url ?? "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: show(anon),
    SUPABASE_SERVICE_ROLE_KEY: show(service),
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "MISSING",
    NODE_ENV: process.env.NODE_ENV,
  };

  if (!url) {
    return NextResponse.json({ ok: false, problem: "NEXT_PUBLIC_SUPABASE_URL is not set", env });
  }

  // Can this server reach Supabase at all?
  const started = Date.now();
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: anon ? { apikey: anon } : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    // Is the compliance bucket there? Its absence is why uploads fail with
    // "Bucket not found".
    let storage: unknown = "not checked (no service role key)";
    if (service) {
      try {
        const { data, error } = await createAdminClient().storage.listBuckets();
        if (error) {
          storage = { ok: false, error: error.message };
        } else {
          const names = (data ?? []).map((b) => b.name);
          storage = names.includes("compliance")
            ? { ok: true, complianceBucket: "present", buckets: names }
            : {
                ok: false,
                complianceBucket: "MISSING",
                buckets: names,
                fix: "Run supabase/migrations/0008_storage_compliance.sql",
              };
        }
      } catch (e) {
        storage = { ok: false, error: (e as Error).message };
      }
    }

    return NextResponse.json({
      ok: res.ok,
      reachedSupabase: true,
      status: res.status,
      storage,
      tookMs: Date.now() - started,
      env,
    });
  } catch (error) {
    const err = error as Error & { cause?: { code?: string; message?: string } };
    return NextResponse.json({
      ok: false,
      reachedSupabase: false,
      problem: "This server could not reach Supabase.",
      error: err.message,
      cause: err.cause?.code ?? err.cause?.message ?? null,
      likely:
        err.cause?.code === "ENOTFOUND"
          ? "The project URL is wrong — that hostname does not exist."
          : err.cause?.code === "ECONNREFUSED" || err.cause?.code === "ETIMEDOUT"
            ? "Outbound HTTPS from this host is blocked or timing out."
            : "Check the URL first, then whether the host allows outbound HTTPS.",
      tookMs: Date.now() - started,
      env,
    });
  }
}
