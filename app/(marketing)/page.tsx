import Link from "next/link";
import { HeroSearch } from "@/features/search/components/hero-search";
import { createPublicClient } from "@/lib/supabase/public";
import { supabaseConfigured } from "@/lib/env";
import { money } from "@/lib/format";

const DOCS = [
  ["GDC registration", "Number verified, renewal date tracked"],
  ["Photo ID", "Passport or driving licence, checked against the profile"],
  ["Enhanced DBS check", "Enhanced certificate, with issue date on file"],
  ["Indemnity insurance", "Certificate and cover period"],
  ["Hepatitis B", "Evidence of immunity"],
  ["CPR certificate", "In-date resuscitation training"],
  ["Infection control", "Current training record"],
];

const STEPS = [
  ["Search", "Role, date, hours and distance from your postcode."],
  ["Choose", "Compare rates and experience. Request, or book instantly."],
  ["Locum accepts", "They're notified straight away and confirm or decline."],
  ["Confirmed", "Both sides get the details. Your invoice is raised."],
  ["Shift worked", "You pay the locum their rate. The booking closes."],
];

/**
 * The headline fee was hard-coded, and had already drifted: it read £30 while
 * the cheapest published fee was £20. Reading the real minimum means the page
 * can't quote a figure the fee table doesn't offer.
 *
 * A marketing page must never 500 because the database is unreachable, so a
 * failure falls back to the lowest fee at the time of writing.
 */
const LOWEST_FEE_FALLBACK = 30;

async function lowestBookingFee(): Promise<number> {
  if (!supabaseConfigured()) return LOWEST_FEE_FALLBACK;
  try {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("fees")
      .select("amount")
      .eq("fee_type", "booking")
      .is("effective_to", null)
      .order("amount", { ascending: true })
      .limit(1);
    if (error) throw error;
    return data?.[0]?.amount ?? LOWEST_FEE_FALLBACK;
  } catch (error) {
    console.error("[home] Could not read the lowest booking fee:", error);
    return LOWEST_FEE_FALLBACK;
  }
}

// Matches /pricing: a fee change shows here within five minutes.
export const revalidate = 300;

export default async function HomePage() {
  const fee = await lowestBookingFee();

  return (
    <>
      <section className="px-6 pb-10 pt-16">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 max-w-[34ch] text-muted">Locum cover for dental practices across the UK.</p>
          <h1 className="max-w-[15ch] text-[clamp(38px,7.4vw,72px)] font-extrabold leading-[1.02] tracking-tight">
            Reliable dental cover, <span className="block">just a booking away.</span>
          </h1>
          <p className="mt-6 max-w-[52ch] text-lg text-muted">
            Search dental nurses, hygienists, orthodontic therapists and receptionists by date,
            distance and rate.
            Book the one you want. Pay them their rate directly — and pay us one flat fee per
            booking, with no VAT added.
          </p>
          <HeroSearch />
        </div>
      </section>

      <section id="practices" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-[clamp(30px,4.6vw,44px)] font-extrabold tracking-tight">Two ways in.</h2>
          <p className="mt-3 text-lg text-muted">One platform, two sides of the same booking. Both free to join.</p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="flex flex-col rounded-2xl border border-line bg-white p-8">
              <h3 className="text-2xl font-extrabold tracking-tight">I am a dental practice</h3>
              <p className="mt-2 text-muted">Cover a sickness, a holiday or a permanent gap — without ringing several agencies.</p>
              <ul className="my-6 space-y-2 text-[15px]">
                {["Search by role, date, postcode and availability",
                  "See each locum's hourly rate before you book",
                  "Request cover, or book instantly once you're trusted",
                  "Every invoice and payment, itemised"].map((t) => (
                  <li key={t} className="border-b border-line py-2 last:border-0">{t}</li>
                ))}
              </ul>
              <Link href="/register/practice" className="mt-auto self-start rounded-full bg-pine px-6 py-3 font-semibold text-white">
                Register your practice
              </Link>
            </div>

            <div id="locums" className="flex flex-col rounded-2xl bg-pine p-8 text-white">
              <h3 className="text-2xl font-extrabold tracking-tight">I&apos;m a locum</h3>
              <p className="mt-2 text-[#B7D2CC]">Set your rate, set your radius, and take only the shifts you want.</p>
              <ul className="my-6 space-y-2 text-[15px]">
                {["Free to register — no fee to join, now or later",
                  "You set your own hourly rate",
                  "You set how far you're willing to travel",
                  "Paid your full rate, direct from the practice"].map((t) => (
                  <li key={t} className="border-b border-white/15 py-2 last:border-0">{t}</li>
                ))}
              </ul>
              <Link href="/register/locum" className="mt-auto self-start rounded-full bg-amber px-6 py-3 font-semibold text-[#12211F]">
                Create a locum profile
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-pine px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-[40ch] text-[clamp(30px,4.6vw,44px)] font-extrabold tracking-tight">
            We don&apos;t take a cut of your day rate.
          </h2>
          <p className="mt-3 max-w-[50ch] text-lg text-[#B7D2CC]">
            Most agencies quote the practice one number and pay the locum a smaller one.
            Brighttemp splits the payment in two, and shows both.
          </p>

          <div className="mt-9 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-white/20 bg-white/5 p-7">
              <p className="text-sm font-bold text-amber">Practice → Locum</p>
              <h3 className="mt-3 text-2xl font-extrabold tracking-tight">The locum&apos;s rate</h3>
              <p className="my-3 text-4xl font-extrabold tracking-tight">
                <span className="mr-2 text-xl font-bold text-[#B7D2CC]">from</span>
                £18.00/hr
              </p>
              <p className="text-[#B7D2CC]">Set by the locum, visible before booking, paid direct. Brighttemp takes nothing from it.</p>
            </div>
            <div className="rounded-2xl border border-amber bg-amber/10 p-7">
              <p className="text-sm font-bold text-amber">Practice → Brighttemp</p>
              <h3 className="mt-3 text-2xl font-extrabold tracking-tight">Our booking fee</h3>
              <p className="my-3 text-4xl font-extrabold tracking-tight">
                <span className="mr-2 text-xl font-bold text-[#B7D2CC]">from</span>
                {money(fee)} flat
              </p>
              <p className="text-[#B7D2CC]">
                One fee per booking — not per hour, not a percentage, and no VAT on top.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="compliance" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-[40ch] text-[clamp(30px,4.6vw,44px)] font-extrabold tracking-tight">
            Only fully compliant locums reach your search results.
          </h2>
          <p className="mt-3 max-w-[52ch] text-lg text-muted">
            We hold and monitor compliance documents for every locum, each checked by our team and tracked to its expiry date.
          </p>

          <div className="mt-8 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {DOCS.map(([title, sub]) => (
              <div key={title} className="rounded-xl border border-line border-l-4 border-l-mint bg-white px-5 py-4">
                <strong className="block">{title}</strong>
                <span className="text-sm text-muted">{sub}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 rounded-xl border border-[#F0DFA8] bg-[#FFF7E0] px-6 py-5 text-[#54451A]">
            <strong>If a document expires, the locum comes out of search automatically.</strong>{" "}
            They can&apos;t be booked again until it&apos;s replaced and re-approved.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-[clamp(30px,4.6vw,44px)] font-extrabold tracking-tight">From your uncovered shift to confirmed cover.</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(([title, body], i) => (
              <li key={title} className="border-t-2 border-pine pt-4">
                <span className="text-sm font-extrabold text-amber-deep">{i + 1}</span>
                <h3 className="mt-2 text-lg font-extrabold tracking-tight">{title}</h3>
                <p className="mt-1 text-sm text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-amber px-6 py-20 text-center">
        <h2 className="mx-auto max-w-[18ch] text-[clamp(32px,5.4vw,52px)] font-extrabold tracking-tight">
          Fill your uncovered shift with reliable locum cover.
        </h2>
        <p className="mx-auto mt-5 max-w-[46ch] text-lg text-[#54451A]">
          Free to register, either side. You&apos;ll be booking within a day of approval.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/register/practice" className="rounded-full bg-pine px-7 py-3.5 font-semibold text-white">
            Register your practice
          </Link>
          <Link href="/register/locum" className="rounded-full border-2 border-[#54451A] px-7 py-3.5 font-semibold text-[#3A3010]">
            Join as a locum
          </Link>
        </div>
      </section>
    </>
  );
}
