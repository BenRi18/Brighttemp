import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  DEMO_ACCOUNTS,
  PUBLIC_PAGES,
  demoPreviewEnabled,
} from "@/features/dev/demo";
import { signInAsDemo, signOutDemo } from "@/features/dev/actions";
import { mockModeEnabled } from "@/lib/supabase/mock";

export const metadata = { title: "Page preview — Brighttemp", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function DevPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!demoPreviewEnabled()) notFound();

  const { error } = await searchParams;
  const preview = mockModeEnabled();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <p className="mb-2 inline-block rounded-full bg-amber px-3 py-1 text-xs font-semibold text-[#12211F]">
          Development only — not available in production
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">Page preview</h1>
        <p className="mt-2 max-w-[62ch] text-muted">
          Every page in the app. Click any portal page to open it as that account.
        </p>

        {preview ? (
          <div className="mt-6 rounded-xl border border-[#F0DFA8] bg-[#FFF7E0] px-5 py-4 text-sm text-[#54451A]">
            <p className="font-semibold">Preview mode — sample data, no database, no sign-in.</p>
            <p className="mt-1">
              Buttons and forms respond, but nothing is saved. To use your real Supabase data
              instead, remove <code className="rounded bg-white px-1.5 py-0.5">MOCK_DATA=true</code>{" "}
              from <code className="rounded bg-white px-1.5 py-0.5">.env.local</code> and restart{" "}
              <code className="rounded bg-white px-1.5 py-0.5">npm run dev</code>.
            </p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-line bg-white px-5 py-4 text-sm text-muted">
            <p className="font-semibold text-[#12211F]">Live mode — your real Supabase project.</p>
            <p className="mt-1">
              Buttons sign in as the demo accounts. To look around without a database, add{" "}
              <code className="rounded bg-paper px-1.5 py-0.5">MOCK_DATA=true</code> to{" "}
              <code className="rounded bg-paper px-1.5 py-0.5">.env.local</code> and restart.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-5 py-4 text-sm">
          <span className="text-muted">Signed in as</span>
          <span className="font-semibold">{user?.email ?? "nobody"}</span>
          {user ? (
            <form action={signOutDemo} className="ml-auto">
              <button className="rounded-full border border-line px-4 py-1.5 font-semibold text-muted">
                Sign out
              </button>
            </form>
          ) : null}
        </div>

        {error && !preview ? (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-semibold">Couldn&apos;t sign in as that demo account: {error}</p>
            <p className="mt-1">
              Create the accounts first:{" "}
              <code className="rounded bg-white px-1.5 py-0.5">
                node --env-file=.env.local scripts/create-demo-users.mjs
              </code>{" "}
              then run <code className="rounded bg-white px-1.5 py-0.5">supabase/seed/demo_seed.sql</code>.
            </p>
          </div>
        ) : null}

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-bold">Public pages</h2>
          <div className="flex flex-wrap gap-2">
            {PUBLIC_PAGES.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-pine hover:border-pine"
              >
                {p.label}
              </Link>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">
            Sign out first to see these as a visitor — signed-in users are sent to their dashboard from the auth pages.
          </p>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          {DEMO_ACCOUNTS.map((a) => (
            <div key={a.key} className="rounded-xl border border-line bg-white p-5">
              <p className="text-xs font-semibold text-muted">{a.role}</p>
              <h2 className="mt-1 text-lg font-bold">{a.label}</h2>
              <p className="mt-1 text-sm text-muted">{a.shows}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {a.pages.map((p) => (
                  <form key={p.href} action={signInAsDemo}>
                    <input type="hidden" name="account" value={a.key} />
                    <input type="hidden" name="next" value={p.href} />
                    <button className="rounded-full bg-pine px-4 py-2 text-sm font-semibold text-white hover:bg-pine-deep">
                      {p.label}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </section>

        <p className="mt-10 text-sm text-muted">
          Booking detail pages are reached from each Bookings list. The demo data resets whenever
          you re-run <code>demo_seed.sql</code>.
        </p>
      </div>
    </div>
  );
}
