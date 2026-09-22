import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";

export const metadata = { title: "Pricing — Brighttemp" };

/**
 * Reads the live fees table rather than hard-coding the numbers, so changing a
 * fee in the admin dashboard updates the public page too.
 */
export default async function PricingPage() {
  const supabase = await createClient();
  const [{ data: roles }, { data: fees }] = await Promise.all([
    supabase.from("roles").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("fees").select("role_id, day_type, amount, fee_type").is("effective_to", null),
  ]);

  const lookup = new Map(
    (fees ?? [])
      .filter((f) => f.fee_type === "booking")
      .map((f) => [`${f.role_id}:${f.day_type}`, Number(f.amount)]),
  );
  const sameDay = (fees ?? []).find((f) => f.fee_type === "same_day_surcharge");
  const cancellation = (fees ?? []).find((f) => f.fee_type === "cancellation");

  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <h1 className="text-[clamp(32px,5vw,48px)] font-extrabold tracking-tight">One flat fee, per booking.</h1>
      <p className="mt-4 max-w-[52ch] text-lg text-muted">
        Charged to the practice only. Locums pay nothing, and practices pay nothing to register.
      </p>

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
            {(roles ?? []).map((r) => (
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
    </section>
  );
}
