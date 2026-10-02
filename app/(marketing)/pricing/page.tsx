import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { supabaseConfigured } from "@/lib/env";

type Role = { id: string; name: string };
type Fee = { role_id: string | null; day_type: string | null; amount: number; fee_type: string };

/**
 * The published fees. A marketing page must never 500 because the database
 * is unreachable, so a failure here returns nothing and the page says so.
 */
async function loadFees(): Promise<{ roles: Role[]; fees: Fee[]; ok: boolean }> {
  if (!supabaseConfigured()) return { roles: [], fees: [], ok: false };
  try {
    const supabase = await createClient();
    const [{ data: roles, error: rolesError }, { data: fees, error: feesError }] = await Promise.all([
      supabase.from("roles").select("id, name").eq("is_active", true).order("sort_order"),
      supabase.from("fees").select("role_id, day_type, amount, fee_type").is("effective_to", null),
    ]);
    if (rolesError || feesError) throw rolesError ?? feesError;
    return { roles: roles ?? [], fees: (fees ?? []) as Fee[], ok: true };
  } catch (error) {
    console.error("[pricing] Could not load the fee table:", error);
    return { roles: [], fees: [], ok: false };
  }
}

export const metadata = { title: "Pricing — Brighttemp" };

/**
 * Reads the live fees table rather than hard-coding the numbers, so changing a
 * fee in the admin dashboard updates the public page too.
 */
export default async function PricingPage() {
  const { roles, fees, ok } = await loadFees();

  const lookup = new Map(
    fees
      .filter((f) => f.fee_type === "booking")
      .map((f) => [`${f.role_id}:${f.day_type}`, Number(f.amount)]),
  );
  const sameDay = fees.find((f) => f.fee_type === "same_day_surcharge");
  const cancellation = fees.find((f) => f.fee_type === "cancellation");

  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <h1 className="text-[clamp(32px,5vw,48px)] font-extrabold tracking-tight">One flat fee, per booking.</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-muted">
        Charged to the practice only. Locums pay nothing, and practices pay nothing to register.
        No VAT is added — the fee below is what you pay.
      </p>

      {!ok ? (
        <p className="mt-10 rounded-xl border border-[#F0DFA8] bg-[#FFF7E0] px-6 py-5 text-[#54451A]">
          Our fees aren&apos;t loading at the moment. Email{" "}
          <a className="underline" href="mailto:hello@brighttemp.co.uk">hello@brighttemp.co.uk</a>{" "}
          and we&apos;ll send them straight over.
        </p>
      ) : (
      <div className="mt-10 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[540px]">
          <thead>
            <tr className="bg-[#EAF0EA] text-left text-sm text-muted">
              <th className="px-5 py-4 font-semibold">Role</th>
              <th className="px-5 py-4 font-semibold">Weekday</th>
              <th className="px-5 py-4 font-semibold">Weekend</th>
              <th className="px-5 py-4 font-semibold">Bank holiday</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-5 py-4">{r.name}</td>
                {["weekday", "weekend", "bank_holiday"].map((d) => (
                  <td key={d} className="px-5 py-4 font-extrabold tracking-tight">
                    {money(lookup.get(`${r.id}:${d}`) ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="px-5 py-4">Booked on the day of the shift</td>
              <td colSpan={3} className="px-5 py-4 font-extrabold tracking-tight">
                +{money(Number(sameDay?.amount ?? 0))} on the fee above
              </td>
            </tr>
            <tr className="border-t border-line">
              <td className="px-5 py-4">Cancelled with under 24 hours&apos; notice</td>
              <td colSpan={3} className="px-5 py-4 font-extrabold tracking-tight">
                {money(Number(cancellation?.amount ?? 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      )}

      <p className="mt-5 max-w-[60ch] text-muted">
        These fees are not VAT-rated, so nothing is added at invoice. What you pay the locum is
        separate and settled directly with them.
      </p>
    </section>
  );
}
