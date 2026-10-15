import { NextResponse, type NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  // Which process answered, and what build is it actually serving?
  //
  // When more than one instance is running — the startup log showing several
  // "▲ Next.js / Ready" banners in a row is the tell — requests land on
  // whichever one happens to answer. An older instance still holding the port
  // serves its own older build, so a route that exists in the source 404s
  // intermittently and a redeploy appears to do nothing. Refresh this a few
  // times: if pid or buildId changes between refreshes, that is what is
  // happening, and the fix is to stop the app fully and start one instance.
  const instance = (() => {
    const root = process.cwd();
    const read = (rel: string) => {
      try {
        return readFileSync(join(root, rel), "utf8");
      } catch {
        return null;
      }
    };
    const manifest = read(".next/server/app-paths-manifest.json");
    let routes: string[] = [];
    try {
      routes = manifest ? Object.keys(JSON.parse(manifest)) : [];
    } catch {
      /* unreadable manifest */
    }
    return {
      pid: process.pid,
      uptimeSeconds: Math.round(process.uptime()),
      buildId: read(".next/BUILD_ID")?.trim() ?? "unknown",
      memoryMB: Math.round(process.memoryUsage().rss / 1048576),
      // The route that has been 404ing. Present here means THIS instance can
      // serve it; absent means this instance is running an older build.
      hasAuthConfirm: routes.includes("/auth/confirm/route"),
      hasAuthCallback: routes.includes("/auth/callback/route"),
      routeCount: routes.length,
    };
  })();

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: url ?? "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: show(anon),
    SUPABASE_SERVICE_ROLE_KEY: show(service),
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "MISSING",
    NODE_ENV: process.env.NODE_ENV,
  };

  if (!url) {
    return NextResponse.json({ ok: false, problem: "NEXT_PUBLIC_SUPABASE_URL is not set", instance, env });
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
      instance,
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
      instance,
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
